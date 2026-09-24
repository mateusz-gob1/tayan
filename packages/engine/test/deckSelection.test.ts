import { describe, expect, it } from 'vitest';
import { DECK_TABLE, chooseDeck, defaultStartingCards, simulateRates } from '../src/deckSelection';
import { seededRng } from '../src/rng';

describe('deck selection', () => {
  it('uses the precomputed table for standard settings', () => {
    const c = chooseDeck({ players: 6, startingCards: 2, eliminationLimit: 5 });
    expect(c).toEqual({ lowestRank: 5, warning: false, source: 'table' });
    expect(chooseDeck({ players: 12, startingCards: 1, eliminationLimit: 5 }).warning).toBe(true);
  });

  it('simulation matches the reference table within one rank', () => {
    const rng = seededRng(7);
    for (let players = 2; players <= 13; players++) {
      const c = chooseDeck(
        { players, startingCards: defaultStartingCards(players), eliminationLimit: 5 },
        { games: 400, rng, forceSimulation: true },
      );
      const expected = DECK_TABLE[players]!.lowestRank;
      expect(Math.abs(c.lowestRank - expected), `players=${players}`).toBeLessThanOrEqual(1);
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
