import type { Card, Declaration, Rank, Slot, Suit } from './types';

type Counts = { byRank: number[]; bySuit: Record<Suit, number>; has: Set<string> };

function count(cards: readonly Card[]): Counts {
  const byRank = new Array<number>(15).fill(0);
  const bySuit: Record<Suit, number> = { C: 0, D: 0, H: 0, S: 0 };
  const has = new Set<string>();
  for (const c of cards) {
    byRank[c.rank] = (byRank[c.rank] ?? 0) + 1;
    bySuit[c.suit]++;
    has.add(`${c.rank}${c.suit}`);
  }
  return { byRank, bySuit, has };
}

function runOf(t: Rank): Rank[] {
  return [t - 4, t - 3, t - 2, t - 1, t] as Rank[];
}

/** Does the declared hand occur in the pool of all dealt cards? */
export function existsInPool(decl: Declaration, cards: readonly Card[]): boolean {
  const { byRank, bySuit, has } = count(cards);
  const r0 = decl.ranks[0] as Rank;
  const r1 = decl.ranks[1] as Rank;
  switch (decl.category) {
    case 'HIGH':
      return (byRank[r0] ?? 0) >= 1;
    case 'PAIR':
      return (byRank[r0] ?? 0) >= 2;
    case 'THREE':
      return (byRank[r0] ?? 0) >= 3;
    case 'FOUR':
      return (byRank[r0] ?? 0) >= 4;
    case 'TWO_PAIR':
      return (byRank[r0] ?? 0) >= 2 && (byRank[r1] ?? 0) >= 2;
    case 'FULL':
      return (byRank[r0] ?? 0) >= 3 && (byRank[r1] ?? 0) >= 2;
    case 'STRAIGHT':
      return runOf(r0).every((r) => (byRank[r] ?? 0) >= 1);
    case 'FLUSH':
      return bySuit[decl.suit as Suit] >= 5;
    case 'STRAIGHT_FLUSH':
      return runOf(r0).every((r) => has.has(`${r}${decl.suit}`));
  }
}

export type Match<T extends Card> = {
  exists: boolean;
  matched: T[];
  missing: Slot[];
};

/**
 * Best match of a declaration against the pool: the cards found and the slots still missing.
 * Works also when the hand does not exist, so the reveal can show how much was lacking.
 */
export function matchDeclaration<T extends Card>(decl: Declaration, cards: readonly T[]): Match<T> {
  const matched: T[] = [];
  const missing: Slot[] = [];
  const used = new Set<T>();

  const take = (n: number, pred: (c: T) => boolean, slot: Slot): void => {
    let got = 0;
    for (const c of cards) {
      if (got === n) break;
      if (used.has(c) || !pred(c)) continue;
      used.add(c);
      matched.push(c);
      got++;
    }
    for (; got < n; got++) missing.push({ ...slot });
  };
  const ofRank = (r: Rank) => (c: T) => c.rank === r;

  const r0 = decl.ranks[0] as Rank;
  const r1 = decl.ranks[1] as Rank;
  switch (decl.category) {
    case 'HIGH':
      take(1, ofRank(r0), { rank: r0 });
      break;
    case 'PAIR':
      take(2, ofRank(r0), { rank: r0 });
      break;
    case 'THREE':
      take(3, ofRank(r0), { rank: r0 });
      break;
    case 'FOUR':
      take(4, ofRank(r0), { rank: r0 });
      break;
    case 'TWO_PAIR':
      take(2, ofRank(r0), { rank: r0 });
      take(2, ofRank(r1), { rank: r1 });
      break;
    case 'FULL':
      take(3, ofRank(r0), { rank: r0 });
      take(2, ofRank(r1), { rank: r1 });
      break;
    case 'STRAIGHT':
      for (const r of runOf(r0)) take(1, ofRank(r), { rank: r });
      break;
    case 'FLUSH': {
      const s = decl.suit as Suit;
      take(5, (c) => c.suit === s, { suit: s });
      break;
    }
    case 'STRAIGHT_FLUSH': {
      const s = decl.suit as Suit;
      for (const r of runOf(r0)) take(1, (c) => c.rank === r && c.suit === s, { rank: r, suit: s });
      break;
    }
  }
  return { exists: missing.length === 0, matched, missing };
}

/** Is there any four of a kind in the pool? (used by deck selection) */
export function poolHasFour(cards: readonly Card[]): boolean {
  return count(cards).byRank.some((n) => n >= 4);
}

/** Is there any straight flush (five consecutive ranks of one suit) in the pool? */
export function poolHasStraightFlush(cards: readonly Card[]): boolean {
  const { has } = count(cards);
  for (const suit of ['C', 'D', 'H', 'S']) {
    let run = 0;
    for (let r = 2; r <= 14; r++) {
      run = has.has(`${r}${suit}`) ? run + 1 : 0;
      if (run >= 5) return true;
    }
  }
  return false;
}
