import { z } from 'zod';
import { EngineError, type GameSettings, type Rank } from '@tayan/engine';

export const ERROR_CODES = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'GAME_IN_PROGRESS',
  'NOT_YOUR_TURN',
  'BID_TOO_LOW',
  'NOTHING_TO_CHECK',
  'NOT_HOST',
  'INVALID_PAYLOAD',
  'NICK_TAKEN',
  // beyond the spec's list:
  'NOT_IN_ROOM',
  'NOT_ALLOWED',
  'INVALID_PHASE',
  'INVALID_SETTINGS',
  'NOT_ENOUGH_PLAYERS',
  'RATE_LIMITED',
  'KICKED',
  'SERVER_SHUTDOWN',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type Ack<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: { code: ErrorCode; message?: string } };

export class RoomError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'RoomError';
  }
}

const ENGINE_TO_ROOM: Record<EngineError['code'], ErrorCode> = {
  INVALID_PHASE: 'INVALID_PHASE',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  BID_TOO_LOW: 'BID_TOO_LOW',
  UNKNOWN_DECLARATION: 'INVALID_PAYLOAD',
  NOTHING_TO_CHECK: 'NOTHING_TO_CHECK',
  PLAYER_NOT_ACTIVE: 'NOT_ALLOWED',
  INVALID_SETTINGS: 'INVALID_SETTINGS',
};

export function toRoomError(e: unknown): unknown {
  return e instanceof EngineError ? new RoomError(ENGINE_TO_ROOM[e.code], e.message) : e;
}

const nick = z.string().trim().min(1).max(16);
const code = z
  .string()
  .trim()
  .length(5)
  .transform((s) => s.toUpperCase());
const playerId = z.string().min(1).max(64);
const category = z.enum([
  'HIGH',
  'PAIR',
  'TWO_PAIR',
  'STRAIGHT',
  'THREE',
  'FLUSH',
  'FULL',
  'FOUR',
  'STRAIGHT_FLUSH',
]);

export const settingsSchema = z
  .object({
    deckMode: z.enum(['AUTO', 'FULL', 'CUSTOM']),
    lowestRank: z
      .number()
      .int()
      .min(2)
      .max(9)
      .transform((n) => n as Rank),
    startingCards: z.union([z.literal(1), z.literal(2)]),
    eliminationLimit: z.number().int().min(3).max(6),
    categoryOrder: z
      .array(category)
      .length(9)
      .refine((a) => new Set(a).size === 9, 'categories must be unique'),
    turnTimerSec: z.number().int().min(10).max(600).nullable(),
    inactiveTimeoutSec: z.number().int().min(60).max(3600).nullable(),
    kickVoteAfterSec: z.number().int().min(30).max(600),
    spectatorsSeeCards: z.boolean(),
  })
  .partial()
  .strict();

const empty = z.object({}).passthrough();

/** Client -> server events and their payload schemas. */
export const clientEvents = {
  'room:create': z.object({ nick }),
  'room:join': z.object({
    code,
    nick,
    sessionToken: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .optional(),
  }),
  'room:leave': empty,
  'room:settings': settingsSchema,
  'room:kick': z.object({ playerId }),
  'room:addBot': empty,
  'game:start': empty,
  'game:declare': z.object({ declarationId: z.string().min(1).max(40) }),
  'game:check': empty,
  'game:ready': empty,
  'game:rematch': empty,
  'game:voteKick': z.object({ playerId }),
} as const;

export type ClientEvent = keyof typeof clientEvents;
export type Payload<E extends ClientEvent> = z.infer<(typeof clientEvents)[E]>;

export type SessionPayload = { playerId: string; sessionToken: string; roomCode: string };

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'GAME_OVER';

export type RoomStatePayload = {
  code: string;
  hostId: string;
  phase: RoomPhase;
  members: { id: string; nick: string; connected: boolean; spectator: boolean; bot: boolean }[];
  /** What the host has set explicitly; everything else is automatic. */
  overrides: Partial<GameSettings>;
  /** Effective settings: overrides plus automatic values for the current player count. */
  settings: GameSettings;
  /** True when even the largest allowed deck exceeds the difficulty thresholds. */
  deckWarning: boolean;
  /** Players who clicked "Next" during the reveal. */
  readyIds: string[];
  revealEndsAt?: number;
  kickVote: { targetId: string; votes: string[]; availableAt: number } | null;
};
