import { RANKS, SUITS, type Card, type Rank } from './types';

/** All cards from `lowestRank` up to the ace, in all four suits. */
export function buildDeck(lowestRank: Rank): Card[] {
  const cards: Card[] = [];
  for (const rank of RANKS) {
    if (rank < lowestRank) continue;
    for (const suit of SUITS) cards.push({ rank, suit });
  }
  return cards;
}

export function deckSize(lowestRank: Rank): number {
  return (15 - lowestRank) * 4;
}
