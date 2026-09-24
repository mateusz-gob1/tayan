import type { Card, Category, Declaration, Rank, Slot, Suit } from './types';

export type Lang = 'pl' | 'en';

// Polish forms per rank: nominative sg, nominative pl, genitive sg, genitive pl, locative pl
const PL_RANKS: Record<Rank, [string, string, string, string, string]> = {
  2: ['dwójka', 'dwójki', 'dwójki', 'dwójek', 'dwójkach'],
  3: ['trójka', 'trójki', 'trójki', 'trójek', 'trójkach'],
  4: ['czwórka', 'czwórki', 'czwórki', 'czwórek', 'czwórkach'],
  5: ['piątka', 'piątki', 'piątki', 'piątek', 'piątkach'],
  6: ['szóstka', 'szóstki', 'szóstki', 'szóstek', 'szóstkach'],
  7: ['siódemka', 'siódemki', 'siódemki', 'siódemek', 'siódemkach'],
  8: ['ósemka', 'ósemki', 'ósemki', 'ósemek', 'ósemkach'],
  9: ['dziewiątka', 'dziewiątki', 'dziewiątki', 'dziewiątek', 'dziewiątkach'],
  10: ['dziesiątka', 'dziesiątki', 'dziesiątki', 'dziesiątek', 'dziesiątkach'],
  11: ['walet', 'walety', 'waleta', 'waletów', 'waletach'],
  12: ['dama', 'damy', 'damy', 'dam', 'damach'],
  13: ['król', 'króle', 'króla', 'króli', 'królach'],
  14: ['as', 'asy', 'asa', 'asów', 'asach'],
};

const EN_RANKS: Record<Rank, [string, string]> = {
  2: ['two', 'twos'],
  3: ['three', 'threes'],
  4: ['four', 'fours'],
  5: ['five', 'fives'],
  6: ['six', 'sixes'],
  7: ['seven', 'sevens'],
  8: ['eight', 'eights'],
  9: ['nine', 'nines'],
  10: ['ten', 'tens'],
  11: ['jack', 'jacks'],
  12: ['queen', 'queens'],
  13: ['king', 'kings'],
  14: ['ace', 'aces'],
};

const PL_SUITS: Record<Suit, { nom: string; loc: string }> = {
  C: { nom: 'trefl ♣', loc: 'w treflu ♣' },
  D: { nom: 'karo ♦', loc: 'w karo ♦' },
  H: { nom: 'kier ♥', loc: 'w kierze ♥' },
  S: { nom: 'pik ♠', loc: 'w piku ♠' },
};
const EN_SUITS: Record<Suit, string> = {
  C: 'clubs ♣',
  D: 'diamonds ♦',
  H: 'hearts ♥',
  S: 'spades ♠',
};

export const CATEGORY_NAMES: Record<Lang, Record<Category, string>> = {
  pl: {
    HIGH: 'Wysoka karta',
    PAIR: 'Para',
    TWO_PAIR: 'Dwie pary',
    STRAIGHT: 'Strit',
    THREE: 'Trójka',
    FLUSH: 'Kolor',
    FULL: 'Full',
    FOUR: 'Kareta',
    STRAIGHT_FLUSH: 'Poker',
  },
  en: {
    HIGH: 'High card',
    PAIR: 'Pair',
    TWO_PAIR: 'Two pair',
    STRAIGHT: 'Straight',
    THREE: 'Three of a kind',
    FLUSH: 'Flush',
    FULL: 'Full house',
    FOUR: 'Four of a kind',
    STRAIGHT_FLUSH: 'Straight flush',
  },
};

export function rankLabel(rank: Rank): string {
  const faces: Partial<Record<Rank, string>> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  return faces[rank] ?? String(rank);
}

export const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };

export function formatCard(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

/** Human-readable name of a declaration, e.g. "Full: damy na dziewiątkach". */
export function formatDeclaration(decl: Declaration, lang: Lang): string {
  const [r0, r1] = decl.ranks as [Rank, Rank];
  const name = CATEGORY_NAMES[lang][decl.category];
  const suit = decl.suit as Suit;
  if (lang === 'pl') {
    switch (decl.category) {
      case 'HIGH':
        return `${name}: ${PL_RANKS[r0][0]}`;
      case 'PAIR':
      case 'THREE':
      case 'FOUR':
        return `${name} ${PL_RANKS[r0][3]}`;
      case 'TWO_PAIR':
        return `${name}: ${PL_RANKS[r0][1]} i ${PL_RANKS[r1][1]}`;
      case 'STRAIGHT':
        return `${name} do ${PL_RANKS[r0][2]}`;
      case 'FLUSH':
        return `${name}: ${PL_SUITS[suit].nom}`;
      case 'FULL':
        return `${name}: ${PL_RANKS[r0][1]} na ${PL_RANKS[r1][4]}`;
      case 'STRAIGHT_FLUSH':
        return `${name} do ${PL_RANKS[r0][2]} ${PL_SUITS[suit].loc}`;
    }
  }
  const single = (r: Rank) => EN_RANKS[r][0];
  const plural = (r: Rank) => EN_RANKS[r][1];
  switch (decl.category) {
    case 'HIGH':
      return `${name}: ${single(r0)}`;
    case 'PAIR':
    case 'THREE':
    case 'FOUR':
      return `${name}: ${plural(r0)}`;
    case 'TWO_PAIR':
      return `${name}: ${plural(r0)} and ${plural(r1)}`;
    case 'STRAIGHT':
      return `${name} to the ${single(r0)}`;
    case 'FLUSH':
      return `${name}: ${EN_SUITS[suit]}`;
    case 'FULL':
      return `${name}: ${plural(r0)} full of ${plural(r1)}`;
    case 'STRAIGHT_FLUSH':
      return `${name} to the ${single(r0)} of ${EN_SUITS[suit]}`;
  }
}

/** Describes a missing slot, e.g. "queen" or "spades ♠". */
export function formatSlot(slot: Slot, lang: Lang): string {
  if (slot.rank && slot.suit)
    return lang === 'pl'
      ? `${PL_RANKS[slot.rank][0]} ${PL_SUITS[slot.suit].nom}`
      : `${EN_RANKS[slot.rank][0]} of ${EN_SUITS[slot.suit]}`;
  if (slot.rank) return lang === 'pl' ? PL_RANKS[slot.rank][0] : EN_RANKS[slot.rank][0];
  if (slot.suit) return lang === 'pl' ? PL_SUITS[slot.suit].nom : EN_SUITS[slot.suit];
  return '?';
}
