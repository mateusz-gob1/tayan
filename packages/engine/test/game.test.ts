import { describe, expect, it } from 'vitest';
import { randomBot } from '../src/bot';
import { formatDeclaration, formatSlot, formatCard, rankLabel } from '../src/format';
import { activePlayers, applyAction, createGame, resolveSettings, type Ctx } from '../src/game';
import { seededRng } from '../src/rng';
import { EngineError, type Rank, type Card, type GameState, type PlayerId } from '../src/types';
import { toPlayerView } from '../src/view';
import { cards } from './helpers';

const ctx = (seed = 1): Ctx => ({ rng: seededRng(seed), now: 1000 });

function withHands(state: GameState, hands: Record<PlayerId, Card[]>): GameState {
  return { ...state, round: { ...state.round, hands } };
}

function newGame(n = 3, settings = {}) {
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  return createGame(ids, settings, ctx()).state;
}

describe('setup', () => {
  it('resolves default settings from the player count', () => {
    expect(resolveSettings({}, 4)).toMatchObject({
      startingCards: 2,
      lowestRank: 8,
      eliminationLimit: 5,
    });
    expect(resolveSettings({}, 8)).toMatchObject({ startingCards: 1, lowestRank: 3 });
    expect(resolveSettings({ deckMode: 'FULL' }, 3).lowestRank).toBe(2);
    expect(resolveSettings({ deckMode: 'CUSTOM', lowestRank: 6 }, 3).lowestRank).toBe(6);
  });

  it('deals starting cards and randomises seating', () => {
    const s = newGame(4);
    expect(s.seating.slice().sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(s.round.starter).toBe(s.seating[0]);
    for (const p of s.seating) expect(s.round.hands[p]).toHaveLength(2);
  });

  it('deals distinct cards', () => {
    const s = newGame(6);
    const all = Object.values(s.round.hands).flat().map(formatCard);
    expect(new Set(all).size).toBe(all.length);
  });

  it('rejects invalid setups', () => {
    expect(() => createGame(['a'], {}, ctx())).toThrow(EngineError);
    expect(() => createGame(['a', 'a'], {}, ctx())).toThrow(EngineError);
    expect(() =>
      createGame(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { deckMode: 'CUSTOM', lowestRank: 9 }, ctx()),
    ).toThrow(/deck too small/);
    expect(() => createGame(['a', 'b'], { eliminationLimit: 2 }, ctx())).toThrow(EngineError);
  });
});

describe('bidding', () => {
  it('enforces turn order, raises and checking rules', () => {
    let s = newGame(3);
    const [a, b, c] = s.seating as [string, string, string];
    expect(() => applyAction(s, { type: 'CHECK', playerId: a }, ctx())).toThrow(/NOTHING_TO_CHECK/);
    expect(() =>
      applyAction(s, { type: 'DECLARE', playerId: b, declarationId: 'HIGH:14' }, ctx()),
    ).toThrow(/NOT_YOUR_TURN/);
    expect(() =>
      applyAction(s, { type: 'DECLARE', playerId: a, declarationId: 'NOPE' }, ctx()),
    ).toThrow(/UNKNOWN_DECLARATION/);
    s = applyAction(s, { type: 'DECLARE', playerId: a, declarationId: 'PAIR:14' }, ctx()).state;
    expect(s.round.currentTurn).toBe(b);
    expect(() =>
      applyAction(s, { type: 'DECLARE', playerId: b, declarationId: 'PAIR:14' }, ctx()),
    ).toThrow(/BID_TOO_LOW/);
    expect(() =>
      applyAction(s, { type: 'DECLARE', playerId: b, declarationId: 'HIGH:14' }, ctx()),
    ).toThrow(/BID_TOO_LOW/);
    s = applyAction(s, { type: 'DECLARE', playerId: b, declarationId: 'THREE:14' }, ctx()).state;
    expect(s.round.currentTurn).toBe(c);
  });

  it('a bid is not possible in the reveal phase', () => {
    let s = newGame(2);
    const [a, b] = s.seating as [string, string];
    s = applyAction(s, { type: 'DECLARE', playerId: a, declarationId: 'HIGH:14' }, ctx()).state;
    s = applyAction(s, { type: 'CHECK', playerId: b }, ctx()).state;
    expect(() =>
      applyAction(s, { type: 'DECLARE', playerId: a, declarationId: 'PAIR:14' }, ctx()),
    ).toThrow(/INVALID_PHASE/);
  });
});

describe('check and rounds', () => {
  function setup() {
    const s = newGame(3);
    const [a, b, c] = s.seating as [string, string, string];
    const hands = { [a]: cards('QH 9C'), [b]: cards('QS 10D'), [c]: cards('2H 3H') };
    return { s: withHands(s, hands), a, b, c };
  }

  it('gives the checker a card when the hand exists', () => {
    const { s, a, b } = setup();
    let st = applyAction(
      s,
      { type: 'DECLARE', playerId: a, declarationId: 'PAIR:12' },
      ctx(),
    ).state;
    const r = applyAction(st, { type: 'CHECK', playerId: b }, ctx());
    st = r.state;
    expect(st.round.result).toMatchObject({
      existed: true,
      loserId: b,
      checkerId: b,
      declarerId: a,
    });
    expect(st.cardCounts[b]).toBe(3);
    expect(st.round.phase).toBe('REVEAL');
    expect(r.events.map((e) => e.type)).toEqual(['CHECKED', 'REVEALED']);
    expect(st.round.result?.missingSlots).toEqual([]);
    expect(st.round.result?.matchedCards.map((m) => m.ownerId).sort()).toEqual([a, b].sort());
  });

  it('gives the declarer a card when the hand is missing and reports what was lacking', () => {
    const { s, a, b } = setup();
    let st = applyAction(
      s,
      { type: 'DECLARE', playerId: a, declarationId: 'THREE:12' },
      ctx(),
    ).state;
    st = applyAction(st, { type: 'CHECK', playerId: b }, ctx()).state;
    expect(st.round.result).toMatchObject({ existed: false, loserId: a });
    expect(st.round.result?.missingSlots).toEqual([{ rank: 12 }]);
    expect(st.cardCounts[a]).toBe(3);
  });

  it('rotates the starter over active players regardless of who lost', () => {
    let { s } = setup();
    const order = s.seating;
    const starters: string[] = [s.round.starter];
    for (let i = 0; i < 4; i++) {
      const cur = s.round.currentTurn;
      s = applyAction(s, { type: 'DECLARE', playerId: cur, declarationId: 'HIGH:14' }, ctx()).state;
      s = applyAction(s, { type: 'CHECK', playerId: s.round.currentTurn }, ctx()).state;
      if (s.winner) break;
      s = applyAction(s, { type: 'NEXT_ROUND' }, ctx(i + 5)).state;
      starters.push(s.round.starter);
    }
    starters.forEach((st, i) => {
      if (i > 0) expect(st).toBe(order[(order.indexOf(starters[i - 1]!) + 1) % 3]);
    });
    expect(starters[0]).toBe(order[0]);
  });

  it('eliminates at the limit, skips eliminated players and ends with a winner', () => {
    let s = newGame(3, { startingCards: 2, eliminationLimit: 3 });
    const target = s.seating[1] as string;
    // make `target` lose by giving him a hopeless declaration each time
    for (let guard = 0; guard < 60 && !s.winner; guard++) {
      if (s.round.phase === 'REVEAL') {
        s = applyAction(s, { type: 'NEXT_ROUND' }, ctx(guard)).state;
        continue;
      }
      const cur = s.round.currentTurn;
      s = applyAction(s, { type: 'DECLARE', playerId: cur, declarationId: 'HIGH:14' }, ctx()).state;
      const next = s.round.currentTurn;
      s = applyAction(s, { type: 'CHECK', playerId: next }, ctx()).state;
    }
    expect(s.winner).toBeDefined();
    expect(s.eliminated).toHaveLength(2);
    expect(activePlayers(s)).toEqual([s.winner]);
    void target;
    expect(() => applyAction(s, { type: 'NEXT_ROUND' }, ctx())).toThrow(/INVALID_PHASE/);
    const view = toPlayerView(s, s.winner!);
    expect(view.phase).toBe('GAME_OVER');
    expect(view.winner).toBe(s.winner);
    expect(view.lastResult).toBeDefined();
  });

  it('a dead player is skipped in the turn order', () => {
    let s = newGame(3);
    const [a, b, c] = s.seating as [string, string, string];
    s = applyAction(s, { type: 'ELIMINATE', playerId: b }, ctx()).state; // round restarts
    expect(s.round.number).toBe(2);
    expect(s.round.starter).toBe(c === a ? a : c === s.round.starter ? c : s.round.starter);
    expect(s.round.hands[b]).toBeUndefined();
    const cur = s.round.currentTurn;
    s = applyAction(
      s,
      { type: 'DECLARE', playerId: cur, declarationId: s.declarations[0]!.id },
      ctx(),
    ).state;
    expect(s.round.currentTurn).not.toBe(b);
  });
});

describe('forced elimination', () => {
  it('ends the game when one player remains', () => {
    let s = newGame(2);
    const [a, b] = s.seating as [string, string];
    const r = applyAction(s, { type: 'ELIMINATE', playerId: a }, ctx());
    s = r.state;
    expect(s.winner).toBe(b);
    expect(r.events.map((e) => e.type)).toEqual(['PLAYER_ELIMINATED', 'GAME_OVER']);
    expect(() => applyAction(s, { type: 'ELIMINATE', playerId: b }, ctx())).toThrow(
      /INVALID_PHASE/,
    );
  });

  it('rejects unknown or already-eliminated players and works during reveal', () => {
    let s = newGame(3);
    expect(() => applyAction(s, { type: 'ELIMINATE', playerId: 'zzz' }, ctx())).toThrow(
      /PLAYER_NOT_ACTIVE/,
    );
    const [a, b, c] = s.seating as [string, string, string];
    s = applyAction(
      s,
      { type: 'DECLARE', playerId: a, declarationId: s.declarations[0]!.id },
      ctx(),
    ).state;
    s = applyAction(s, { type: 'CHECK', playerId: b }, ctx()).state;
    s = applyAction(s, { type: 'ELIMINATE', playerId: c }, ctx()).state;
    expect(s.round.phase).toBe('REVEAL');
    expect(() => applyAction(s, { type: 'ELIMINATE', playerId: c }, ctx())).toThrow(
      /PLAYER_NOT_ACTIVE/,
    );
    s = applyAction(s, { type: 'NEXT_ROUND' }, ctx()).state;
    expect(s.round.hands[c]).toBeUndefined();
  });
});

describe('toPlayerView', () => {
  it('never contains other players cards while bidding', () => {
    const s = newGame(4);
    for (const me of s.seating) {
      const json = JSON.stringify(toPlayerView(s, me));
      for (const other of s.seating) {
        if (other === me) continue;
        expect(toPlayerView(s, me).lastResult).toBeUndefined();
        for (const c of s.round.hands[other]!) {
          const mine = s.round.hands[me]!.some((m) => m.rank === c.rank && m.suit === c.suit);
          if (!mine) expect(json).not.toContain(`"rank":${c.rank},"suit":"${c.suit}"`);
        }
      }
    }
  });

  it('gives spectators no cards, and shows all hands after the reveal', () => {
    let s = newGame(3);
    expect(toPlayerView(s, 'spectator').myCards).toEqual([]);
    const [a, b] = s.seating as [string, string];
    s = applyAction(
      s,
      { type: 'DECLARE', playerId: a, declarationId: s.declarations[0]!.id },
      ctx(),
    ).state;
    const v = toPlayerView(s, b, { [b]: { nick: 'Bea', connected: false } });
    expect(v.canCheck).toBe(true);
    expect(v.allowedDeclarationMinOrder).toBe(1);
    expect(v.players.find((p) => p.id === b)).toMatchObject({ nick: 'Bea', connected: false });
    expect(toPlayerView(s, a).canCheck).toBe(false);
    s = applyAction(s, { type: 'CHECK', playerId: b }, ctx()).state;
    const revealed = toPlayerView(s, 'spectator');
    expect(revealed.phase).toBe('REVEAL');
    expect(Object.keys(revealed.lastResult!.allHands)).toHaveLength(3);
  });

  it('total cards in hands equal the sum of active counters', () => {
    let s = newGame(5);
    for (let i = 0; i < 20 && !s.winner; i++) {
      const total = Object.values(s.round.hands).reduce((n, h) => n + h.length, 0);
      const counts = activePlayers(s).reduce((n, p) => n + s.cardCounts[p]!, 0);
      if (s.round.phase === 'BIDDING') expect(total).toBe(counts);
      if (s.round.phase === 'REVEAL') {
        s = applyAction(s, { type: 'NEXT_ROUND' }, ctx(i)).state;
        continue;
      }
      const cur = s.round.currentTurn;
      s = applyAction(s, { type: 'DECLARE', playerId: cur, declarationId: 'HIGH:14' }, ctx()).state;
      s = applyAction(s, { type: 'CHECK', playerId: s.round.currentTurn }, ctx()).state;
    }
  });
});

describe('format', () => {
  const s = newGame(3, { deckMode: 'FULL' });
  const f = (id: string, lang: 'pl' | 'en') =>
    formatDeclaration(
      s.declarations.find((d) => d.id === id)!,
      lang,
    );

  it('formats Polish names', () => {
    expect(f('FULL:12:9', 'pl')).toBe('Full: damy na dziewiątkach');
    expect(f('STRAIGHT_FLUSH:14:S', 'pl')).toBe('Poker do asa w piku ♠');
    expect(f('PAIR:12', 'pl')).toBe('Para dam');
    expect(f('TWO_PAIR:12:9', 'pl')).toBe('Dwie pary: damy i dziewiątki');
    expect(f('STRAIGHT:12', 'pl')).toBe('Strit do damy');
    expect(f('FLUSH:H', 'pl')).toBe('Kolor: kier ♥');
    expect(f('HIGH:13', 'pl')).toBe('Wysoka karta: król');
  });

  it('formats English names', () => {
    expect(f('FULL:12:9', 'en')).toBe('Full house: queens full of nines');
    expect(f('STRAIGHT_FLUSH:14:S', 'en')).toBe('Straight flush to the ace of spades ♠');
    expect(f('TWO_PAIR:12:9', 'en')).toBe('Two pair: queens and nines');
    expect(f('STRAIGHT:12', 'en')).toBe('Straight to the queen');
    expect(f('FOUR:2', 'en')).toBe('Four of a kind: twos');
    expect(f('HIGH:13', 'en')).toBe('High card: king');
    expect(f('FLUSH:C', 'en')).toBe('Flush: clubs ♣');
  });

  it('formats slots and cards', () => {
    expect(formatSlot({ rank: 12 }, 'pl')).toBe('dama');
    expect(formatSlot({ rank: 12, suit: 'H' }, 'en')).toBe('queen of hearts ♥');
    expect(formatSlot({ rank: 12, suit: 'H' }, 'pl')).toBe('dama kier ♥');
    expect(formatSlot({ suit: 'S' }, 'en')).toBe('spades ♠');
    expect(formatSlot({ suit: 'S' }, 'pl')).toBe('pik ♠');
    expect(formatSlot({ rank: 9 }, 'en')).toBe('nine');
    expect(formatSlot({}, 'en')).toBe('?');
    expect(formatCard({ rank: 10, suit: 'D' })).toBe('10♦');
    expect(rankLabel(14)).toBe('A');
  });
});

const deckLimit = (players: number) => 4 * players; // cards needed at the default limit

describe('random simulation', () => {
  it('10 000 random games all end with exactly one winner and no exception', () => {
    const rng = seededRng(12345);
    const bot = randomBot(rng);
    for (let g = 0; g < 10_000; g++) {
      const n = 2 + rng.int(12);
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const c: Ctx = { rng, now: 0 };
      // explicit deck: AUTO with non-standard settings would run a simulation per game
      const maxLow = Math.min(9, 15 - Math.ceil(deckLimit(n) / 4)); // 4 cards per player must fit
      const lowestRank = (2 + rng.int(maxLow - 1)) as Rank;
      let s = createGame(
        ids,
        { startingCards: (1 + rng.int(2)) as 1 | 2, deckMode: 'CUSTOM', lowestRank },
        c,
      ).state;
      let steps = 0;
      while (!s.winner) {
        if (++steps > 5000) throw new Error(`game ${g} did not finish`);
        if (s.round.phase === 'REVEAL') {
          s = applyAction(s, { type: 'NEXT_ROUND' }, c).state;
          continue;
        }
        const me = s.round.currentTurn;
        const intent = bot.decide(toPlayerView(s, me));
        s = applyAction(s, { ...intent, playerId: me }, c).state;
      }
      expect(activePlayers(s)).toEqual([s.winner]);
      expect(s.eliminated).toHaveLength(n - 1);
    }
  });
});
