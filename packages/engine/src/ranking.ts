import { poolSizeDistribution } from './poolDistribution';
import {
  categoryProbability,
  ratAbsDiffLE,
  ratAdd,
  ratDiv,
  ratMul,
  ZERO,
  type Rational,
} from './probability';
import { DEFAULT_CATEGORY_ORDER, type Category, type Rank } from './types';

/** Two categories within this of each other are a tie, broken by `baseOrder` (2 percentage points). */
export const EPSILON: Rational = { num: 2n, den: 100n };

/**
 * Sorts categories from most common (index 0, the weakest hand a player may declare) to rarest
 * (last index, the strongest). Ties (within `epsilon`) keep their relative order in `baseOrder`
 * instead of the raw, possibly-noisy comparison, so the result never "flickers" between
 * equivalent orderings. Implements `docs/ranking-algorithm.md` section 4 (`tayan-lab`).
 */
/** `-1` if `a < b`, `1` if `a > b`, `0` if equal — by cross-multiplication, never by dividing. */
function compareRat(a: Rational, b: Rational): number {
  const left = a.num * b.den;
  const right = b.num * a.den;
  return left === right ? 0 : left > right ? 1 : -1;
}

export function rankCategories(
  pBar: Record<Category, Rational>,
  epsilon: Rational = EPSILON,
  baseOrder: readonly Category[] = DEFAULT_CATEGORY_ORDER,
): Category[] {
  const baseIndex = new Map(baseOrder.map((c, i) => [c, i]));
  return [...baseOrder].sort((a, b) => {
    if (ratAbsDiffLE(pBar[a], pBar[b], epsilon))
      return (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0);
    return -compareRat(pBar[a], pBar[b]); // higher probability (more common) sorts first
  });
}

/**
 * The weighted-average probability `p̄_c` of one specific declaration of category `c`, over every
 * round of a whole game (section 3): `p_c` at each pool size `N`, weighted by how many rounds the
 * game actually spends at that `N`.
 */
function weightedAverage(
  category: Category,
  lowestRank: Rank,
  roundsByN: Map<number, Rational>,
  expectedRounds: Rational,
): Rational {
  let sum: Rational = ZERO;
  for (const [N, rounds] of roundsByN)
    sum = ratAdd(sum, ratMul(rounds, categoryProbability(category, lowestRank, N)));
  return ratDiv(sum, expectedRounds);
}

const cache = new Map<string, Category[]>();

/**
 * The default `categoryOrder` for a game: computed once, from the deck and player count already
 * decided for that game, never recomputed mid-game. Implements section 4's `rankCategoriesStatic`
 * (`tayan-lab`). Memoized, because `resolveSettings` also calls this to preview a game's settings
 * in the lobby before anyone has started it (`apps/server/src/room.ts`), and the underlying
 * Markov chain is not something to redo on every render.
 */
export function rankCategoriesStatic(
  lowestRank: Rank,
  players: number,
  startingCards: number,
  eliminationLimit: number,
): Category[] {
  const key = `${lowestRank}|${players}|${startingCards}|${eliminationLimit}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const { roundsByN, expectedRounds } = poolSizeDistribution(
    players,
    startingCards,
    eliminationLimit,
  );
  const pBar = Object.fromEntries(
    DEFAULT_CATEGORY_ORDER.map((c) => [
      c,
      weightedAverage(c, lowestRank, roundsByN, expectedRounds),
    ]),
  ) as Record<Category, Rational>;
  const order = rankCategories(pBar);
  cache.set(key, order);
  return order;
}
