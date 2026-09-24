import { RANKS, SUITS, type Category, type DeckConfig, type Declaration, type Rank } from './types';

type Draft = Omit<Declaration, 'order'>;

function draftsFor(category: Category, ranks: readonly Rank[]): Draft[] {
  const out: Draft[] = [];
  switch (category) {
    case 'HIGH':
    case 'PAIR':
    case 'THREE':
    case 'FOUR':
      for (const r of ranks) out.push({ id: `${category}:${r}`, category, ranks: [r] });
      break;
    case 'TWO_PAIR':
      // a > b; higher pair first, then lower pair
      for (const a of ranks)
        for (const b of ranks)
          if (a > b) out.push({ id: `TWO_PAIR:${a}:${b}`, category, ranks: [a, b] });
      break;
    case 'FULL':
      // three of a, pair of b; order by trips, then pair
      for (const a of ranks)
        for (const b of ranks)
          if (a !== b) out.push({ id: `FULL:${a}:${b}`, category, ranks: [a, b] });
      break;
    case 'STRAIGHT': {
      const lowest = ranks[0] as Rank;
      for (const t of ranks)
        if (t - 4 >= lowest) out.push({ id: `STRAIGHT:${t}`, category, ranks: [t] });
      break;
    }
    case 'FLUSH':
      for (const s of SUITS) out.push({ id: `FLUSH:${s}`, category, ranks: [], suit: s });
      break;
    case 'STRAIGHT_FLUSH': {
      const lowest = ranks[0] as Rank;
      for (const t of ranks)
        if (t - 4 >= lowest)
          for (const s of SUITS)
            out.push({ id: `STRAIGHT_FLUSH:${t}:${s}`, category, ranks: [t], suit: s });
      break;
    }
  }
  return out;
}

/**
 * Full, strictly ordered list of declarations for a deck. A raise means a higher `order`.
 * Within a category: main parameter first, then the secondary one (suits: C < D < H < S).
 */
export function generateDeclarations(config: DeckConfig): Declaration[] {
  const ranks = RANKS.filter((r) => r >= config.lowestRank);
  const list: Declaration[] = [];
  for (const category of config.categoryOrder) {
    for (const d of draftsFor(category, ranks)) list.push({ ...d, order: list.length });
  }
  return list;
}

export function isHigher(a: Declaration, b: Declaration): boolean {
  return a.order > b.order;
}

const cache = new Map<string, Declaration[]>();

/** Memoized `generateDeclarations`; the returned list must not be mutated. */
export function getDeclarations(config: DeckConfig): Declaration[] {
  const key = `${config.lowestRank}|${config.categoryOrder.join(',')}`;
  let list = cache.get(key);
  if (!list) {
    list = generateDeclarations(config);
    cache.set(key, list);
  }
  return list;
}

const byIdCache = new WeakMap<readonly Declaration[], Map<string, Declaration>>();

/** O(1) lookup of a declaration by id within a generated list. */
export function findDeclaration(list: readonly Declaration[], id: string): Declaration | undefined {
  let map = byIdCache.get(list);
  if (!map) {
    map = new Map(list.map((d) => [d.id, d]));
    byIdCache.set(list, map);
  }
  return map.get(id);
}
