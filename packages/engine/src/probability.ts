import type { Category, Rank } from './types';

/**
 * An exact fraction, kept as a `{ numerator, denominator }` pair (`denominator` always positive,
 * not necessarily reduced). Every comparison in `ranking.ts` goes through these, never through
 * `Number`, so the same category order comes out on the server and in every client's browser
 * (see `docs/ranking-algorithm.md` section 8 in `tayan-lab`, and its port in `docs/adr/0007-...`).
 */
export type Rational = { readonly num: bigint; readonly den: bigint };

export const ZERO: Rational = { num: 0n, den: 1n };

function bigAbs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function gcd(a: bigint, b: bigint): bigint {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Reduces to lowest terms (denominator stays positive). Every value that comes out of `ratAdd`,
 * `ratMul` and `ratDiv` is already reduced: nothing here changes what a fraction *means*, it only
 * keeps the numerator and denominator from growing without bound through long chains of additions
 * (a whole game's worth of Markov-chain transitions), the way Python's `fractions.Fraction`
 * (the reference implementation) reduces automatically on every operation.
 */
export function ratReduce(r: Rational): Rational {
  if (r.num === 0n) return ZERO;
  const sign = r.den < 0n ? -1n : 1n;
  const num = r.num * sign;
  const den = r.den * sign;
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

export function ratAdd(a: Rational, b: Rational): Rational {
  return ratReduce({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
}

export function ratMul(a: Rational, b: Rational): Rational {
  return ratReduce({ num: a.num * b.num, den: a.den * b.den });
}

/** `a / b`, both cross-multiplied against the target instead of ever dividing. */
export function ratDiv(a: Rational, b: Rational): Rational {
  return ratReduce({ num: a.num * b.den, den: a.den * b.num });
}

export function ratFromBigInt(n: bigint, d: bigint = 1n): Rational {
  return d >= 0n ? { num: n, den: d } : { num: -n, den: -d };
}

/** `a > b`, by cross-multiplication (both denominators are always positive). */
export function ratGT(a: Rational, b: Rational): boolean {
  return a.num * b.den > b.num * a.den;
}

/** `|a - b| <= eps`, by cross-multiplication, no subtraction into a possibly-negative fraction. */
export function ratAbsDiffLE(a: Rational, b: Rational, eps: Rational): boolean {
  const diffNum = a.num * b.den - b.num * a.den; // sign matches a-b since a.den,b.den > 0
  const diffDen = a.den * b.den; // > 0
  const absNum = diffNum < 0n ? -diffNum : diffNum;
  return absNum * eps.den <= eps.num * diffDen;
}

const binomialCache = new Map<string, bigint>();

/** `C(n, k)`, exact, 0 whenever `k < 0` or `k > n` (matches the convention in the research spec). */
export function binomial(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  const key = `${n},${k}`;
  const cached = binomialCache.get(key);
  if (cached !== undefined) return cached;
  let result = 1n;
  const kk = Math.min(k, n - k);
  for (let i = 0; i < kk; i++) result = (result * BigInt(n - i)) / BigInt(i + 1);
  binomialCache.set(key, result);
  return result;
}

/**
 * `p_c(D, N)`: the exact probability that one specific declaration of category `c` exists in a
 * uniformly random pool of `N` cards drawn (without replacement) from a `D`-card deck starting at
 * `lowestRank`. Implements the formulas in `docs/ranking-algorithm.md` section 2 (`tayan-lab`).
 */
export function categoryProbability(category: Category, lowestRank: Rank, N: number): Rational {
  const D = (15 - lowestRank) * 4;
  const R = 15 - lowestRank; // ranks in the deck
  const C = (n: number, k: number) => binomial(n, k);

  const oneRank = (k: number): bigint => {
    // sum_{i=k}^{4} C(4, i) * C(D - 4, N - i)
    let sum = 0n;
    for (let i = k; i <= 4; i++) sum += C(4, i) * C(D - 4, N - i);
    return sum;
  };
  const twoRanks = (iRange: [number, number], jRange: [number, number]): bigint => {
    // sum_i sum_j C(4, i) * C(4, j) * C(D - 8, N - i - j)
    let sum = 0n;
    for (let i = iRange[0]; i <= iRange[1]; i++)
      for (let j = jRange[0]; j <= jRange[1]; j++) sum += C(4, i) * C(4, j) * C(D - 8, N - i - j);
    return sum;
  };

  let favorable: bigint;
  switch (category) {
    case 'HIGH':
      favorable = oneRank(1);
      break;
    case 'PAIR':
      favorable = oneRank(2);
      break;
    case 'THREE':
      favorable = oneRank(3);
      break;
    case 'FOUR':
      favorable = oneRank(4);
      break;
    case 'TWO_PAIR':
      favorable = twoRanks([2, 4], [2, 4]);
      break;
    case 'FULL':
      favorable = twoRanks([3, 4], [2, 4]);
      break;
    case 'STRAIGHT': {
      // inclusion-exclusion over the 5 specific ranks: sum_{j=0}^{5} (-1)^j C(5,j) C(D-4j, N)
      let sum = 0n;
      for (let j = 0; j <= 5; j++) {
        const term = C(5, j) * C(D - 4 * j, N);
        sum += j % 2 === 0 ? term : -term;
      }
      favorable = sum;
      break;
    }
    case 'FLUSH': {
      // sum_{i=5}^{R} C(R, i) * C(D - R, N - i)
      let sum = 0n;
      for (let i = 5; i <= R; i++) sum += C(R, i) * C(D - R, N - i);
      favorable = sum;
      break;
    }
    case 'STRAIGHT_FLUSH':
      favorable = C(D - 5, N - 5);
      break;
  }
  return { num: favorable, den: C(D, N) };
}
