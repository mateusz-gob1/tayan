import { getDeclarations } from '../src/declarations';
import type { Card, Category, Declaration, Rank, Suit } from '../src/types';
import { DEFAULT_CATEGORY_ORDER } from '../src/types';

const FACES: Record<string, Rank> = { J: 11, Q: 12, K: 13, A: 14 };

/** Parses 'QH', '10S', '9C' into a card. */
export function card(s: string): Card {
  const suit = s.slice(-1) as Suit;
  const r = s.slice(0, -1);
  return { rank: (FACES[r] ?? Number(r)) as Rank, suit };
}

export function cards(s: string): Card[] {
  return s.split(/\s+/).filter(Boolean).map(card);
}

export function decl(id: string, lowestRank: Rank = 2): Declaration {
  const found = getDeclarations({ lowestRank, categoryOrder: DEFAULT_CATEGORY_ORDER }).find(
    (d) => d.id === id,
  );
  if (!found) throw new Error(`no declaration ${id}`);
  return found;
}

export const ALL_CATEGORIES: readonly Category[] = DEFAULT_CATEGORY_ORDER;
