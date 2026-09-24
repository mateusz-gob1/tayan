import { deckSize, buildDeck } from './deck';
import { poolHasFour, poolHasStraightFlush } from './pool';
import { seededRng, shuffle, type Rng } from './rng';
import type { Rank } from './types';

/** Tunable thresholds: max share of rounds in which the pool contains a four / a straight flush. */
export const DECK_THRESHOLDS = { four: 0.15, straightFlush: 0.1 };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 13;
export const DEFAULT_ELIMINATION_LIMIT = 5;

/** Default starting cards: 2 up to 6 players, 1 from 7. */
export function defaultStartingCards(players: number): 1 | 2 {
  return players <= 6 ? 2 : 1;
}

/**
 * Precomputed result of the auto-selection algorithm for standard settings
 * (default starting cards, elimination limit 5). Regenerate with `pnpm engine:deck-table`.
 */
export const DECK_TABLE: Readonly<Record<number, { lowestRank: Rank; warning: boolean }>> = {
  2: { lowestRank: 9, warning: false },
  3: { lowestRank: 9, warning: false },
  4: { lowestRank: 8, warning: false },
  5: { lowestRank: 7, warning: false },
  6: { lowestRank: 5, warning: false },
  7: { lowestRank: 5, warning: false },
  8: { lowestRank: 3, warning: false },
  9: { lowestRank: 2, warning: false },
  10: { lowestRank: 2, warning: true },
  11: { lowestRank: 2, warning: true },
  12: { lowestRank: 2, warning: true },
  13: { lowestRank: 2, warning: true },
};

export type SimParams = {
  players: number;
  startingCards: number;
  eliminationLimit: number;
  lowestRank: Rank;
  games: number;
};

export type SimResult = {
  rounds: number;
  fourRate: number;
  straightFlushRate: number;
  avgCardsInPlay: number;
};

/** Simulates games with a random loser each round and measures how often strong hands occur. */
export function simulateRates(p: SimParams, rng: Rng): SimResult {
  const deck = buildDeck(p.lowestRank);
  let rounds = 0;
  let fours = 0;
  let sflushes = 0;
  let cards = 0;
  for (let g = 0; g < p.games; g++) {
    const counts = new Array<number>(p.players).fill(p.startingCards);
    let alive = Array.from({ length: p.players }, (_, i) => i);
    while (alive.length > 1) {
      const total = alive.reduce((s, i) => s + (counts[i] as number), 0);
      const pool = shuffle(deck, rng).slice(0, total);
      rounds++;
      cards += total;
      if (poolHasFour(pool)) fours++;
      if (poolHasStraightFlush(pool)) sflushes++;
      const loser = alive[rng.int(alive.length)] as number;
      counts[loser] = (counts[loser] as number) + 1;
      if ((counts[loser] as number) >= p.eliminationLimit) alive = alive.filter((i) => i !== loser);
    }
  }
  return {
    rounds,
    fourRate: fours / rounds,
    straightFlushRate: sflushes / rounds,
    avgCardsInPlay: cards / rounds,
  };
}

export type DeckChoice = {
  lowestRank: Rank;
  /** True when even the best available deck exceeds the thresholds. */
  warning: boolean;
  source: 'table' | 'simulation';
};

export type ChooseDeckParams = {
  players: number;
  startingCards: number;
  eliminationLimit: number;
};

/** Auto deck selection: smallest deck within the thresholds (falls back to the full deck). */
export function chooseDeck(
  p: ChooseDeckParams,
  opts: { games?: number; rng?: Rng; forceSimulation?: boolean } = {},
): DeckChoice {
  const standard =
    p.startingCards === defaultStartingCards(p.players) &&
    p.eliminationLimit === DEFAULT_ELIMINATION_LIMIT;
  const tabled = DECK_TABLE[p.players];
  if (standard && tabled && !opts.forceSimulation) return { ...tabled, source: 'table' };

  // Default-options results are deterministic, so memoize them (the server calls this often).
  const memoKey = `${p.players}|${p.startingCards}|${p.eliminationLimit}`;
  const memoizable = !opts.rng && !opts.games && !opts.forceSimulation;
  const hit = memoizable ? choiceCache.get(memoKey) : undefined;
  if (hit) return hit;

  const choice = simulateChoice(p, opts);
  if (memoizable) choiceCache.set(memoKey, choice);
  return choice;
}

const choiceCache = new Map<string, DeckChoice>();

function simulateChoice(
  p: ChooseDeckParams,
  opts: { games?: number; rng?: Rng },
): DeckChoice {
  const rng = opts.rng ?? seededRng(1);
  const games = opts.games ?? 300;
  const maxHand = p.eliminationLimit - 1;
  for (let lowest = 9; lowest >= 2; lowest--) {
    const lowestRank = lowest as Rank;
    if (maxHand * p.players > deckSize(lowestRank)) continue;
    const r = simulateRates({ ...p, lowestRank, games }, rng);
    if (
      r.fourRate <= DECK_THRESHOLDS.four &&
      r.straightFlushRate <= DECK_THRESHOLDS.straightFlush
    ) {
      return { lowestRank, warning: false, source: 'simulation' };
    }
  }
  return { lowestRank: 2, warning: true, source: 'simulation' };
}
