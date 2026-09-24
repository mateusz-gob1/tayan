import { buildDeck, deckSize } from './deck';
import { findDeclaration, getDeclarations } from './declarations';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  chooseDeck,
  defaultEliminationLimit,
  defaultStartingCards,
} from './deckSelection';
import { existsInPool, matchDeclaration } from './pool';
import { shuffle, type Rng } from './rng';
import {
  DEFAULT_CATEGORY_ORDER,
  EngineError,
  type Action,
  type Card,
  type GameEvent,
  type GameSettings,
  type GameState,
  type PlayerId,
  type RoundResult,
} from './types';

export type Ctx = { rng: Rng; now?: number };
export type ActionResult = { state: GameState; events: GameEvent[] };

/** Resolves partial host settings into full settings for the given number of players. */
export function resolveSettings(input: Partial<GameSettings>, players: number): GameSettings {
  const startingCards = input.startingCards ?? defaultStartingCards(players);
  const eliminationLimit = input.eliminationLimit ?? defaultEliminationLimit(players);
  const deckMode = input.deckMode ?? 'AUTO';
  let lowestRank = input.lowestRank ?? 9;
  if (deckMode === 'FULL') lowestRank = 2;
  else if (deckMode === 'AUTO')
    lowestRank = chooseDeck({ players, startingCards, eliminationLimit }).lowestRank;
  return {
    deckMode,
    lowestRank,
    startingCards,
    eliminationLimit,
    categoryOrder: input.categoryOrder ?? [...DEFAULT_CATEGORY_ORDER],
    turnTimerSec: input.turnTimerSec ?? null,
    inactiveTimeoutSec: input.inactiveTimeoutSec ?? null,
    kickVoteAfterSec: input.kickVoteAfterSec ?? 120,
  };
}

/** Players still in the game, in seating order. */
export function activePlayers(state: GameState): PlayerId[] {
  return state.seating.filter((p) => !state.eliminated.includes(p));
}

/** Next non-eliminated player after `from` in the fixed seating order. */
function nextActive(seating: PlayerId[], eliminated: PlayerId[], from: PlayerId): PlayerId {
  const start = seating.indexOf(from);
  for (let i = 1; i <= seating.length; i++) {
    const p = seating[(start + i) % seating.length] as PlayerId;
    if (!eliminated.includes(p)) return p;
  }
  return from;
}

function dealRound(
  settings: GameSettings,
  seating: PlayerId[],
  eliminated: PlayerId[],
  cardCounts: Record<PlayerId, number>,
  number: number,
  starter: PlayerId,
  rng: Rng,
): GameState['round'] {
  const deck = shuffle(buildDeck(settings.lowestRank), rng);
  const hands: Record<PlayerId, Card[]> = {};
  let offset = 0;
  for (const p of seating) {
    if (eliminated.includes(p)) continue;
    const n = cardCounts[p] as number;
    hands[p] = deck.slice(offset, offset + n);
    offset += n;
  }
  return { number, hands, starter, currentTurn: starter, bids: [], phase: 'BIDDING' };
}

export function createGame(
  playerIds: PlayerId[],
  settingsInput: Partial<GameSettings>,
  ctx: Ctx,
): ActionResult {
  if (new Set(playerIds).size !== playerIds.length)
    throw new EngineError('INVALID_SETTINGS', 'duplicate player ids');
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS)
    throw new EngineError('INVALID_SETTINGS', `players must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  const settings = resolveSettings(settingsInput, playerIds.length);
  if ((settings.eliminationLimit - 1) * playerIds.length > deckSize(settings.lowestRank))
    throw new EngineError('INVALID_SETTINGS', 'deck too small for this many players');
  if (settings.eliminationLimit <= settings.startingCards)
    throw new EngineError('INVALID_SETTINGS', 'elimination limit must exceed starting cards');

  const seating = shuffle(playerIds, ctx.rng);
  const cardCounts: Record<PlayerId, number> = {};
  for (const p of seating) cardCounts[p] = settings.startingCards;
  const declarations = getDeclarations(settings);
  const starter = seating[0] as PlayerId;
  const round = dealRound(settings, seating, [], cardCounts, 1, starter, ctx.rng);
  return {
    state: { settings, declarations, seating, cardCounts, eliminated: [], round },
    events: [{ type: 'ROUND_STARTED', round: 1, starter }],
  };
}

function requireBidding(state: GameState): void {
  if (state.winner || state.round.phase !== 'BIDDING') throw new EngineError('INVALID_PHASE');
}

function requireTurn(state: GameState, playerId: PlayerId): void {
  if (state.round.currentTurn !== playerId) throw new EngineError('NOT_YOUR_TURN');
}

function check(state: GameState, checkerId: PlayerId): ActionResult {
  const { round } = state;
  const last = round.bids[round.bids.length - 1];
  if (!last) throw new EngineError('NOTHING_TO_CHECK');
  const decl = findDeclaration(state.declarations, last.declarationId);
  if (!decl) throw new EngineError('UNKNOWN_DECLARATION');

  const pool = Object.entries(round.hands).flatMap(([ownerId, cards]) =>
    cards.map((c) => ({ rank: c.rank, suit: c.suit, ownerId })),
  );
  const existed = existsInPool(decl, pool);
  const match = matchDeclaration(decl, pool);
  const loserId = existed ? checkerId : last.playerId;

  const cardCounts = { ...state.cardCounts, [loserId]: (state.cardCounts[loserId] as number) + 1 };
  const loserEliminated = (cardCounts[loserId] as number) >= state.settings.eliminationLimit;
  const eliminated = loserEliminated ? [...state.eliminated, loserId] : state.eliminated;

  const result: RoundResult = {
    checkerId,
    declarerId: last.playerId,
    declarationId: decl.id,
    existed,
    matchedCards: match.matched.map((m) => ({
      card: { rank: m.rank, suit: m.suit },
      ownerId: m.ownerId,
    })),
    missingSlots: existed ? [] : match.missing,
    loserId,
    loserEliminated,
    allHands: round.hands,
  };

  const events: GameEvent[] = [
    { type: 'CHECKED', playerId: checkerId },
    { type: 'REVEALED', result },
  ];
  const next: GameState = {
    ...state,
    cardCounts,
    eliminated,
    round: { ...round, phase: 'REVEAL', result },
  };
  if (loserEliminated) events.push({ type: 'PLAYER_ELIMINATED', playerId: loserId });
  const alive = activePlayers(next);
  if (alive.length === 1) {
    next.winner = alive[0];
    events.push({ type: 'GAME_OVER', winner: alive[0] as PlayerId });
  }
  return { state: next, events };
}

function startNextRound(state: GameState, ctx: Ctx): ActionResult {
  const starter = nextActive(state.seating, state.eliminated, state.round.starter);
  const number = state.round.number + 1;
  const round = dealRound(
    state.settings,
    state.seating,
    state.eliminated,
    state.cardCounts,
    number,
    starter,
    ctx.rng,
  );
  return {
    state: { ...state, round },
    events: [{ type: 'ROUND_STARTED', round: number, starter }],
  };
}

function eliminate(state: GameState, playerId: PlayerId, ctx: Ctx): ActionResult {
  if (!state.seating.includes(playerId) || state.eliminated.includes(playerId))
    throw new EngineError('PLAYER_NOT_ACTIVE');
  const next: GameState = { ...state, eliminated: [...state.eliminated, playerId] };
  const events: GameEvent[] = [{ type: 'PLAYER_ELIMINATED', playerId }];
  const alive = activePlayers(next);
  if (alive.length === 1) {
    next.winner = alive[0];
    events.push({ type: 'GAME_OVER', winner: alive[0] as PlayerId });
    return { state: next, events };
  }
  // In the middle of bidding the round is void: redeal without the removed player.
  if (state.round.phase === 'BIDDING') {
    const restarted = startNextRound(next, ctx);
    return { state: restarted.state, events: [...events, ...restarted.events] };
  }
  return { state: next, events };
}

/** The only entry point that changes game state. Throws `EngineError` on illegal actions. */
export function applyAction(state: GameState, action: Action, ctx: Ctx): ActionResult {
  switch (action.type) {
    case 'DECLARE': {
      requireBidding(state);
      requireTurn(state, action.playerId);
      const decl = findDeclaration(state.declarations, action.declarationId);
      if (!decl) throw new EngineError('UNKNOWN_DECLARATION');
      const last = state.round.bids[state.round.bids.length - 1];
      const lastOrder = last
        ? (findDeclaration(state.declarations, last.declarationId)?.order ?? -1)
        : -1;
      if (decl.order <= lastOrder) throw new EngineError('BID_TOO_LOW');
      const round = {
        ...state.round,
        bids: [
          ...state.round.bids,
          { playerId: action.playerId, declarationId: decl.id, at: ctx.now ?? 0 },
        ],
        currentTurn: nextActive(state.seating, state.eliminated, action.playerId),
      };
      return {
        state: { ...state, round },
        events: [{ type: 'DECLARED', playerId: action.playerId, declarationId: decl.id }],
      };
    }
    case 'CHECK':
      requireBidding(state);
      requireTurn(state, action.playerId);
      return check(state, action.playerId);
    case 'NEXT_ROUND':
      if (state.winner || state.round.phase !== 'REVEAL') throw new EngineError('INVALID_PHASE');
      return startNextRound(state, ctx);
    case 'ELIMINATE':
      if (state.winner) throw new EngineError('INVALID_PHASE');
      return eliminate(state, action.playerId, ctx);
  }
}
