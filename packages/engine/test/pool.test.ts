import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/deck';
import { getDeclarations } from '../src/declarations';
import { existsInPool, matchDeclaration, poolHasFour, poolHasStraightFlush } from '../src/pool';
import { seededRng, shuffle } from '../src/rng';
import { DEFAULT_CATEGORY_ORDER, type Rank } from '../src/types';
import { cards, decl } from './helpers';

describe('existsInPool', () => {
  it('HIGH / PAIR / THREE / FOUR', () => {
    const pool = cards('QH QS QD 9C');
    expect(existsInPool(decl('HIGH:12'), pool)).toBe(true);
    expect(existsInPool(decl('HIGH:13'), pool)).toBe(false);
    expect(existsInPool(decl('PAIR:12'), pool)).toBe(true);
    expect(existsInPool(decl('PAIR:9'), pool)).toBe(false);
    expect(existsInPool(decl('THREE:12'), pool)).toBe(true);
    expect(existsInPool(decl('FOUR:12'), pool)).toBe(false);
    expect(existsInPool(decl('FOUR:12'), cards('QH QS QD QC'))).toBe(true);
  });

  it('TWO_PAIR needs two of each', () => {
    expect(existsInPool(decl('TWO_PAIR:12:9'), cards('QH QS 9D 9C'))).toBe(true);
    expect(existsInPool(decl('TWO_PAIR:12:9'), cards('QH QS 9D KC'))).toBe(false);
    // a four of a kind alone is not two different pairs
    expect(existsInPool(decl('TWO_PAIR:12:9'), cards('QH QS QD QC'))).toBe(false);
  });

  it('FULL: trips of one rank and pair of another; same rank does not count twice', () => {
    expect(existsInPool(decl('FULL:12:9'), cards('QH QS QD 9C 9D'))).toBe(true);
    expect(existsInPool(decl('FULL:12:9'), cards('QH QS QD 9C'))).toBe(false);
    expect(existsInPool(decl('FULL:12:9'), cards('QH QS QD QC 9C'))).toBe(false);
    expect(existsInPool(decl('FULL:9:12'), cards('QH QS QD 9C 9D'))).toBe(false);
  });

  it('STRAIGHT: needs every rank; a missing middle card fails', () => {
    expect(existsInPool(decl('STRAIGHT:13', 9), cards('9H 10S JD QC KC'))).toBe(true);
    expect(existsInPool(decl('STRAIGHT:13', 9), cards('9H 10S QC KC KD'))).toBe(false);
    expect(existsInPool(decl('STRAIGHT:14', 9), cards('AH 10S JD QC KC'))).toBe(true);
    expect(existsInPool(decl('STRAIGHT:14', 9), cards('AH 2S 3D 4C 5C'))).toBe(false);
  });

  it('FLUSH: five cards of the suit, any ranks', () => {
    expect(existsInPool(decl('FLUSH:H'), cards('2H 5H 9H JH KH'))).toBe(true);
    expect(existsInPool(decl('FLUSH:H'), cards('2H 5H 9H JH KS AS'))).toBe(false);
    expect(existsInPool(decl('FLUSH:S'), cards('2H 5H 9H JH KH'))).toBe(false);
  });

  it('STRAIGHT_FLUSH needs the specific suit', () => {
    expect(existsInPool(decl('STRAIGHT_FLUSH:13:H', 9), cards('9H 10H JH QH KH'))).toBe(true);
    expect(existsInPool(decl('STRAIGHT_FLUSH:13:H', 9), cards('9H 10H JH QH KS'))).toBe(false);
    expect(existsInPool(decl('STRAIGHT_FLUSH:13:S', 9), cards('9H 10H JH QH KH'))).toBe(false);
  });
});

describe('matchDeclaration', () => {
  it('reports found cards and missing slots when the hand is absent', () => {
    const m = matchDeclaration(decl('FULL:12:9'), cards('QH QS 9D 9C'));
    expect(m.exists).toBe(false);
    expect(m.matched).toHaveLength(4);
    expect(m.missing).toEqual([{ rank: 12 }]);
  });

  it('reports an empty match when nothing is there', () => {
    const m = matchDeclaration(decl('FLUSH:S'), cards('2H 5H'));
    expect(m.matched).toHaveLength(0);
    expect(m.missing).toHaveLength(5);
    expect(m.missing[0]).toEqual({ suit: 'S' });
  });

  it('keeps extra fields on pool cards (owners)', () => {
    const pool = [
      { rank: 12 as Rank, suit: 'H' as const, ownerId: 'a' },
      { rank: 12 as Rank, suit: 'S' as const, ownerId: 'b' },
    ];
    const m = matchDeclaration(decl('PAIR:12'), pool);
    expect(m.exists).toBe(true);
    expect(m.matched.map((c) => c.ownerId)).toEqual(['a', 'b']);
  });

  it('straight flush lists missing rank+suit slots', () => {
    const m = matchDeclaration(decl('STRAIGHT_FLUSH:13:H', 9), cards('9H 10H JH KS'));
    expect(m.missing).toEqual([
      { rank: 12, suit: 'H' },
      { rank: 13, suit: 'H' },
    ]);
  });
});

describe('pool helpers', () => {
  it('poolHasFour / poolHasStraightFlush', () => {
    expect(poolHasFour(cards('QH QS QD QC'))).toBe(true);
    expect(poolHasFour(cards('QH QS QD 9C'))).toBe(false);
    expect(poolHasStraightFlush(cards('9H 10H JH QH KH'))).toBe(true);
    expect(poolHasStraightFlush(cards('9H 10H JH QH KS'))).toBe(false);
  });
});

describe('pool properties', () => {
  const poolArb = fc
    .record({
      seed: fc.integer(),
      size: fc.integer({ min: 0, max: 24 }),
      low: fc.integer({ min: 2, max: 9 }),
    })
    .map(({ seed, size, low }) => ({
      low: low as Rank,
      pool: shuffle(buildDeck(low as Rank), seededRng(seed)).slice(0, size),
    }));

  it('exists agrees with matchDeclaration for every declaration', () => {
    fc.assert(
      fc.property(poolArb, ({ low, pool }) => {
        for (const d of getDeclarations({
          lowestRank: low,
          categoryOrder: DEFAULT_CATEGORY_ORDER,
        })) {
          expect(existsInPool(d, pool)).toBe(matchDeclaration(d, pool).exists);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('is monotonic: stronger hands imply the weaker ones they contain', () => {
    fc.assert(
      fc.property(poolArb, ({ low, pool }) => {
        const ex = (id: string) => existsInPool(decl(id, low), pool);
        for (let r = low; r <= 14; r++) {
          if (ex(`FOUR:${r}`)) expect(ex(`THREE:${r}`)).toBe(true);
          if (ex(`THREE:${r}`)) expect(ex(`PAIR:${r}`)).toBe(true);
          if (ex(`PAIR:${r}`)) expect(ex(`HIGH:${r}`)).toBe(true);
          for (let q = low; q <= 14; q++) {
            if (q === r) continue;
            if (ex(`FULL:${r}:${q}`)) {
              expect(ex(`THREE:${r}`)).toBe(true);
              expect(ex(`TWO_PAIR:${Math.max(r, q)}:${Math.min(r, q)}`)).toBe(true);
            }
          }
        }
        for (const s of ['C', 'D', 'H', 'S']) {
          for (let t = low + 4; t <= 14; t++) {
            if (ex(`STRAIGHT_FLUSH:${t}:${s}`)) {
              expect(ex(`STRAIGHT:${t}`)).toBe(true);
              expect(ex(`FLUSH:${s}`)).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
