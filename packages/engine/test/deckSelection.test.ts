import { describe, expect, it } from 'vitest';
import { chooseDeck, defaultEliminationLimit, simulateRates } from '../src/deckSelection';
import { seededRng } from '../src/rng';

describe('deck selection', () => {
  it('uses the precomputed table for standard settings', () => {
    const c = chooseDeck({ players: 6, startingCards: 2, eliminationLimit: 6 });
    expect(c).toEqual({ lowestRank: 7, warning: false, source: 'table' });
    // DECK_TABLE's rows come from tayan-lab's own criteria now (docs/adr/0007-...), not from the
    // four/straight-flush simulation below, so `warning` is always false here by design.
    expect(chooseDeck({ players: 12, startingCards: 1, eliminationLimit: 5 }).warning).toBe(false);
    expect(defaultEliminationLimit(10)).toBe(6);
    expect(defaultEliminationLimit(11)).toBe(5);
  });

  // Reference table from the original spec, computed for elimination limit 5 with the historical
  // starting-cards default (<=6 players: 2 cards, from 7: 1) — not today's `defaultStartingCards`,
  // which changed (docs/adr/0007-...) and would no longer match these numbers for 7 players.
  const historicalStartingCards = (players: number): 1 | 2 => (players <= 6 ? 2 : 1);
  const SPEC_TABLE_LIMIT_5: Record<number, number> = {
    2: 9,
    3: 9,
    4: 8,
    5: 7,
    6: 5,
    7: 5,
    8: 3,
    9: 2,
    10: 2,
    11: 2,
    12: 2,
    13: 2,
  };

  it('simulation matches the spec reference table (limit 5) within one rank', () => {
    const rng = seededRng(7);
    for (let players = 2; players <= 13; players++) {
      const c = chooseDeck(
        { players, startingCards: historicalStartingCards(players), eliminationLimit: 5 },
        { games: 400, rng, forceSimulation: true },
      );
      expect(
        Math.abs(c.lowestRank - SPEC_TABLE_LIMIT_5[players]!),
        `players=${players}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  // There used to be a test asserting DECK_TABLE stays close to a fresh simulation. It is gone on
  // purpose: DECK_TABLE now comes from a different, unrelated criterion (docs/adr/0007-...), so
  // the two are expected to diverge, sometimes by more than one rank — that was the whole point
  // of adopting the new table, not a regression to guard against.

  it('simulates non-standard settings and respects the hard deck limit', () => {
    const c = chooseDeck({ players: 4, startingCards: 1, eliminationLimit: 5 }, { games: 200 });
    expect(c.source).toBe('simulation');
    expect(4 * 4).toBeLessThanOrEqual((15 - c.lowestRank) * 4);
    // a huge limit forces the full deck with a warning
    const big = chooseDeck(
      { players: 13, startingCards: 2, eliminationLimit: 5 },
      { games: 100, forceSimulation: true },
    );
    expect(big.lowestRank).toBe(2);
  });

  it('memoizes default-option simulations', () => {
    const p = { players: 5, startingCards: 1, eliminationLimit: 4 };
    const first = chooseDeck(p);
    expect(chooseDeck(p)).toBe(first);
  });

  it('simulateRates gives sane averages', () => {
    const r = simulateRates(
      { players: 2, startingCards: 2, eliminationLimit: 5, lowestRank: 9, games: 300 },
      seededRng(3),
    );
    expect(r.avgCardsInPlay).toBeGreaterThan(4);
    expect(r.avgCardsInPlay).toBeLessThan(8);
    expect(r.fourRate).toBeLessThan(0.05);
  });
});
