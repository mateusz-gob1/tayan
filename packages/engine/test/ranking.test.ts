import { describe, expect, it } from 'vitest';
import { poolSizeDistribution } from '../src/poolDistribution';
import { categoryProbability, ratDiv, ratFromBigInt } from '../src/probability';
import { EPSILON, rankCategories, rankCategoriesStatic } from '../src/ranking';
import { DEFAULT_CATEGORY_ORDER, type Category, type Rank } from '../src/types';

/** Asserts an exact fraction (before reduction the test's own fraction may differ, so compare by cross-multiplication). */
function expectFraction(actual: { num: bigint; den: bigint }, num: bigint, den: bigint) {
  expect(actual.num * den).toBe(num * actual.den);
}

describe('categoryProbability', () => {
  it('example 1: a 20-card deck (from rank 10), pool of 2 — p(PAIR) = 3/95', () => {
    expectFraction(categoryProbability('PAIR', 10 as Rank, 2), 3n, 95n);
  });

  it('example 2: a 24-card deck (from rank 9), pool of 6 — control values', () => {
    const lowestRank = 9 as Rank;
    const N = 6;
    expectFraction(categoryProbability('PAIR', lowestRank, N), 445n, 1771n);
    expectFraction(categoryProbability('TWO_PAIR', lowestRank, N), 1279n, 33649n);
    expectFraction(categoryProbability('STRAIGHT', lowestRank, N), 128n, 1463n);
    expectFraction(categoryProbability('THREE', lowestRank, N), 125n, 3542n);
    expectFraction(categoryProbability('FLUSH', lowestRank, N), 109n, 134596n);
    expectFraction(categoryProbability('FULL', lowestRank, N), 29n, 9614n);
    expectFraction(categoryProbability('FOUR', lowestRank, N), 5n, 3542n);
    expectFraction(categoryProbability('STRAIGHT_FLUSH', lowestRank, N), 1n, 7084n);
  });
});

describe('the whole-game weighted probability (section 3)', () => {
  it('example 3: 2 players, 2 starting cards, elimination limit 6, deck from rank 9', () => {
    const { roundsByN, expectedRounds } = poolSizeDistribution(2, 2, 6);
    const weighted = (c: Category) => {
      let sum = { num: 0n, den: 1n };
      for (const [N, rounds] of roundsByN) {
        const p = categoryProbability(c, 9 as Rank, N);
        sum = {
          num: sum.num * (rounds.den * p.den) + rounds.num * p.num * sum.den,
          den: sum.den * rounds.den * p.den,
        };
      }
      return ratDiv(sum, expectedRounds);
    };
    expectFraction(weighted('HIGH'), 11389n, 15686n);
    expectFraction(weighted('PAIR'), 13841n, 47058n);
    expectFraction(weighted('STRAIGHT'), 28212988n, 159597207n);
    expectFraction(weighted('TWO_PAIR'), 12615367n, 159597207n);
    expectFraction(weighted('THREE'), 455n, 7843n);
    expectFraction(weighted('FLUSH'), 9873n, 2086238n);
    expectFraction(weighted('FULL'), 13372n, 933317n);
    expectFraction(weighted('FOUR'), 13n, 3069n);
    expectFraction(weighted('STRAIGHT_FLUSH'), 67n, 70587n);

    expect(rankCategoriesStatic(9 as Rank, 2, 2, 6)).toEqual([
      'HIGH',
      'PAIR',
      'STRAIGHT',
      'TWO_PAIR',
      'THREE',
      'FLUSH',
      'FULL',
      'FOUR',
      'STRAIGHT_FLUSH',
    ]);
  });
});

describe('rankCategories', () => {
  it('example 4: an epsilon tie breaks by baseOrder, not by the (very slightly) higher raw value', () => {
    const pBar = Object.fromEntries(
      DEFAULT_CATEGORY_ORDER.map((c) => [c, ratFromBigInt(1n, 100n)]),
    ) as Record<Category, ReturnType<typeof ratFromBigInt>>;
    pBar.PAIR = ratFromBigInt(5n, 100n);
    pBar.STRAIGHT = ratFromBigInt(510n, 10000n); // 5.10%, 0.10pp above PAIR — inside epsilon (2pp)
    const baseOrder: Category[] = [
      'PAIR',
      'STRAIGHT',
      ...DEFAULT_CATEGORY_ORDER.filter((c) => c !== 'PAIR' && c !== 'STRAIGHT'),
    ];
    const order = rankCategories(pBar, EPSILON, baseOrder);
    expect(order.indexOf('PAIR')).toBeLessThan(order.indexOf('STRAIGHT'));
  });
});

describe('rankCategoriesStatic against the whole table (section 6)', () => {
  // players -> [lowestRank, startingCards, eliminationLimit, categoryOrder weakest -> strongest]
  const table: [number, Rank, 1 | 2, number, Category[]][] = [
    [
      2,
      9,
      2,
      6,
      ['HIGH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FLUSH', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      3,
      9,
      2,
      6,
      ['HIGH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FULL', 'FLUSH', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      4,
      9,
      2,
      6,
      ['HIGH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FULL', 'FLUSH', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      5,
      8,
      2,
      6,
      ['HIGH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FLUSH', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      6,
      7,
      2,
      6,
      ['HIGH', 'STRAIGHT', 'PAIR', 'TWO_PAIR', 'FLUSH', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      7,
      6,
      2,
      6,
      ['HIGH', 'STRAIGHT', 'PAIR', 'FLUSH', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      8,
      5,
      1,
      6,
      ['HIGH', 'PAIR', 'STRAIGHT', 'FLUSH', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      9,
      3,
      1,
      6,
      ['HIGH', 'FLUSH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      10,
      2,
      1,
      6,
      ['HIGH', 'FLUSH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      11,
      4,
      1,
      5,
      ['HIGH', 'PAIR', 'STRAIGHT', 'FLUSH', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      12,
      3,
      1,
      5,
      ['HIGH', 'FLUSH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
    [
      13,
      2,
      1,
      5,
      ['HIGH', 'FLUSH', 'PAIR', 'STRAIGHT', 'TWO_PAIR', 'THREE', 'FULL', 'FOUR', 'STRAIGHT_FLUSH'],
    ],
  ];

  it.each(table)('%i players', (players, lowestRank, startingCards, eliminationLimit, expected) => {
    expect(rankCategoriesStatic(lowestRank, players, startingCards, eliminationLimit)).toEqual(
      expected,
    );
  });
});
