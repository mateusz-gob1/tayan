import { describe, expect, it } from 'vitest';
import {
  DECK_TABLE,
  chooseDeck,
  defaultEliminationLimit,
  defaultStartingCards,
  simulateRates,
} from '../src/deckSelection';
import { seededRng } from '../src/rng';

describe('deck selection', () => {
  it('uses the precomputed table for standard settings', () => {
    const c = chooseDeck({ players: 6, startingCards: 2, eliminationLimit: 6 });
    expect(c).toEqual({ lowestRank: 2, warning: false, source: 'table' });
    expect(chooseDeck({ players: 12, startingCards: 1, eliminationLimit: 5 }).warning).toBe(true);
    expect(defaultEliminationLimit(10)).toBe(6);
    expect(defaultEliminationLimit(11)).toBe(5);
  });

  // Reference table from the original spec, computed for elimination limit 5.
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
        { players, startingCards: defaultStartingCards(players), eliminationLimit: 5 },
        { games: 400, rng, forceSimulation: true },
      );
      expect(
        Math.abs(c.lowestRank - SPEC_TABLE_LIMIT_5[players]!),
        `players=${players}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('the shipped table matches a fresh simulation with the default limit, within one rank', () => {
    const rng = seededRng(11);
    for (let players = 2; players <= 13; players++) {
      const c = chooseDeck(
        {
          players,
          startingCards: defaultStartingCards(players),
          eliminationLimit: defaultEliminationLimit(players),
        },
        { games: 400, rng, forceSimulation: true },
      );
      expect(
        Math.abs(c.lowestRank - DECK_TABLE[players]!.lowestRank),
        `players=${players}`,
      ).toBeLessThanOrEqual(1);
    }
  });

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
