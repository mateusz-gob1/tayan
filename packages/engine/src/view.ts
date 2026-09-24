import { findDeclaration } from './declarations';
import type { GameState, PlayerId, PlayerView } from './types';

export type PlayerMeta = Record<PlayerId, { nick: string; connected: boolean }>;

/**
 * The ONLY place deciding what a given player may see. Other players' cards appear
 * only through `lastResult.allHands`, and only once the round has been revealed.
 * Spectators (ids not seated) get an empty hand.
 */
export function toPlayerView(
  state: GameState,
  playerId: PlayerId,
  meta: PlayerMeta = {},
): PlayerView {
  const { round } = state;
  const revealed = round.phase === 'REVEAL' || state.winner !== undefined;
  const last = round.bids[round.bids.length - 1];
  const lastOrder = last
    ? (findDeclaration(state.declarations, last.declarationId)?.order ?? -1)
    : -1;
  const myTurn = round.phase === 'BIDDING' && !state.winner && round.currentTurn === playerId;

  const view: PlayerView = {
    me: playerId,
    myCards: round.hands[playerId] ?? [],
    players: state.seating.map((id) => ({
      id,
      nick: meta[id]?.nick ?? id,
      cardCount: state.cardCounts[id] as number,
      eliminated: state.eliminated.includes(id),
      connected: meta[id]?.connected ?? true,
    })),
    currentTurn: round.currentTurn,
    bids: round.bids,
    allowedDeclarationMinOrder: lastOrder + 1,
    canCheck: myTurn && last !== undefined,
    phase: state.winner ? 'GAME_OVER' : round.phase,
    settings: state.settings,
    roundNumber: round.number,
    eliminatedOrder: state.eliminated,
  };
  if (revealed && round.result) view.lastResult = round.result;
  if (state.winner) view.winner = state.winner;
  return view;
}
