import type { GameSettings } from '@tayan/engine';

// Mirrors apps/server/src/protocol.ts (kept in sync by hand; see docs/protocol.md).

export type Ack<T = unknown> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message?: string } };

export type Session = { playerId: string; sessionToken: string; roomCode: string };

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'GAME_OVER';

export type RoomState = {
  code: string;
  hostId: string;
  phase: RoomPhase;
  members: { id: string; nick: string; connected: boolean; spectator: boolean }[];
  overrides: Partial<GameSettings>;
  settings: GameSettings;
  deckWarning: boolean;
  readyIds: string[];
  revealEndsAt?: number;
  kickVote: { targetId: string; votes: string[]; availableAt: number } | null;
};

export type ServerEvent = { type: string; [key: string]: unknown };
