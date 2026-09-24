export type Suit = 'C' | 'D' | 'H' | 'S'; // clubs, diamonds, hearts, spades
export const SUITS: readonly Suit[] = ['C', 'D', 'H', 'S'];

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J ... 14=A
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export type Card = { rank: Rank; suit: Suit };

export type Category =
  | 'HIGH'
  | 'PAIR'
  | 'TWO_PAIR'
  | 'STRAIGHT'
  | 'THREE'
  | 'FLUSH'
  | 'FULL'
  | 'FOUR'
  | 'STRAIGHT_FLUSH';

export const DEFAULT_CATEGORY_ORDER: readonly Category[] = [
  'HIGH',
  'PAIR',
  'TWO_PAIR',
  'STRAIGHT',
  'THREE',
  'FLUSH',
  'FULL',
  'FOUR',
  'STRAIGHT_FLUSH',
];

export type Declaration = {
  id: string; // e.g. 'FULL:12:9', 'FLUSH:H', 'STRAIGHT_FLUSH:14:S'
  category: Category;
  ranks: Rank[]; // rank parameters in order of importance
  suit?: Suit;
  order: number; // index in the sorted list
};

export type DeckConfig = {
  lowestRank: Rank;
  categoryOrder: readonly Category[];
};

/** A slot of a declaration that no card in the pool filled. */
export type Slot = { rank?: Rank; suit?: Suit };

export type PlayerId = string;

export type DeckMode = 'AUTO' | 'FULL' | 'CUSTOM';

export type GameSettings = {
  deckMode: DeckMode;
  lowestRank: Rank; // AUTO: from the deck-selection table, FULL: 2, CUSTOM: chosen by host
  startingCards: 1 | 2;
  eliminationLimit: number; // default 5
  categoryOrder: Category[];
  turnTimerSec: number | null; // null = no limit
  inactiveTimeoutSec: number | null; // null = wait forever (default)
  kickVoteAfterSec: number; // default 120
};

export type Bid = { playerId: PlayerId; declarationId: string; at: number };

export type RoundResult = {
  checkerId: PlayerId;
  declarerId: PlayerId;
  declarationId: string;
  existed: boolean;
  matchedCards: { card: Card; ownerId: PlayerId }[]; // best match, possibly partial
  missingSlots: Slot[]; // what was missing (empty when existed)
  loserId: PlayerId;
  loserEliminated: boolean;
  allHands: Record<PlayerId, Card[]>;
};

export type RoundState = {
  number: number;
  hands: Record<PlayerId, Card[]>; // SERVER ONLY
  starter: PlayerId;
  currentTurn: PlayerId;
  bids: Bid[];
  phase: 'BIDDING' | 'REVEAL';
  result?: RoundResult;
};

export type GameState = {
  settings: GameSettings;
  declarations: Declaration[]; // generated once per game
  seating: PlayerId[]; // fixed order
  cardCounts: Record<PlayerId, number>; // cards to deal
  eliminated: PlayerId[]; // in order of elimination
  round: RoundState;
  winner?: PlayerId;
};

export type PlayerView = {
  me: PlayerId;
  myCards: Card[];
  players: {
    id: PlayerId;
    nick: string;
    cardCount: number;
    eliminated: boolean;
    connected: boolean;
  }[];
  currentTurn: PlayerId;
  bids: Bid[];
  allowedDeclarationMinOrder: number; // UI shows only higher declarations
  canCheck: boolean;
  phase: 'BIDDING' | 'REVEAL' | 'GAME_OVER';
  lastResult?: RoundResult; // only in REVEAL and GAME_OVER
  turnDeadline?: number; // timestamp ms, set by the server
  settings: GameSettings;
  roundNumber: number;
  eliminatedOrder: PlayerId[];
  winner?: PlayerId;
};

export type Action =
  | { type: 'DECLARE'; playerId: PlayerId; declarationId: string }
  | { type: 'CHECK'; playerId: PlayerId }
  | { type: 'NEXT_ROUND' }
  | { type: 'ELIMINATE'; playerId: PlayerId }; // forced: kick vote or inactivity timeout

/** What a player (or bot) may ask for; the caller adds the playerId. */
export type Intent = { type: 'DECLARE'; declarationId: string } | { type: 'CHECK' };

export type GameEvent =
  | { type: 'ROUND_STARTED'; round: number; starter: PlayerId }
  | { type: 'DECLARED'; playerId: PlayerId; declarationId: string }
  | { type: 'CHECKED'; playerId: PlayerId }
  | { type: 'REVEALED'; result: RoundResult }
  | { type: 'PLAYER_ELIMINATED'; playerId: PlayerId }
  | { type: 'GAME_OVER'; winner: PlayerId };

export type EngineErrorCode =
  | 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'BID_TOO_LOW'
  | 'UNKNOWN_DECLARATION'
  | 'NOTHING_TO_CHECK'
  | 'PLAYER_NOT_ACTIVE'
  | 'INVALID_SETTINGS';

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'EngineError';
  }
}
