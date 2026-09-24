import type { Category, Declaration, Rank, Suit } from '@tayan/engine';

export type Param = Rank | Suit;

/** Parameters of a declaration in the order the player picks them: ranks, then suit. */
export function paramsOf(d: Declaration): Param[] {
  return [...d.ranks, ...(d.suit ? [d.suit] : [])];
}

/** Declarations still allowed as a raise (order >= minOrder), grouped by category. */
export function availableByCategory(
  list: readonly Declaration[],
  minOrder: number,
): Map<Category, Declaration[]> {
  const map = new Map<Category, Declaration[]>();
  for (const d of list) {
    if (d.order < minOrder) continue;
    const arr = map.get(d.category);
    if (arr) arr.push(d);
    else map.set(d.category, [d]);
  }
  return map;
}

export type Step =
  | { done: false; index: number; kind: 'rank' | 'suit'; options: Param[] }
  | { done: true; declaration: Declaration };

/**
 * Given the still-allowed declarations of one category and the parameters chosen so far,
 * returns either the next choice to present (only values that lead to an allowed
 * declaration) or the finished declaration.
 */
export function nextStep(candidates: readonly Declaration[], chosen: readonly Param[]): Step {
  const matching = candidates.filter((d) => {
    const p = paramsOf(d);
    return chosen.every((c, i) => p[i] === c);
  });
  const only = matching[0];
  if (matching.length === 1 && only && paramsOf(only).length === chosen.length) {
    return { done: true, declaration: only };
  }
  const index = chosen.length;
  const values = new Set<Param>();
  for (const d of matching) {
    const v = paramsOf(d)[index];
    if (v !== undefined) values.add(v);
  }
  const options = [...values];
  const isRank = typeof options[0] === 'number';
  options.sort((a, b) =>
    isRank
      ? (a as number) - (b as number)
      : SUIT_ORDER.indexOf(a as Suit) - SUIT_ORDER.indexOf(b as Suit),
  );
  return { done: false, index, kind: isRank ? 'rank' : 'suit', options };
}

const SUIT_ORDER: Suit[] = ['C', 'D', 'H', 'S'];

/** i18n key suffix describing what the player is choosing at a given step. */
export function paramLabelKey(category: Category, index: number, kind: 'rank' | 'suit'): string {
  if (kind === 'suit') return 'suit';
  if (category === 'TWO_PAIR') return index === 0 ? 'high' : 'low';
  if (category === 'FULL') return index === 0 ? 'trips' : 'pair';
  if (category === 'STRAIGHT' || category === 'STRAIGHT_FLUSH') return 'top';
  return 'rank';
}
