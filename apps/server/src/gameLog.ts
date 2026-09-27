import { Pool } from 'pg';
import type { Logger } from 'pino';
import type { GameEvent, GameSettings } from '@tayan/engine';

/** A server-only addition to the `GameEvent` stream, not part of the shared engine. */
export type ServerLogEvent =
  | GameEvent
  | {
      type: 'ELIMINATION_REASON';
      playerId: string;
      reason: 'VOTE' | 'INACTIVE' | 'LEFT' | 'KICKED';
    }
  | { type: 'AUTO_PLAYED'; playerId: string };

export type GameLogEntry = {
  code: string;
  startedAt: number;
  endedAt: number;
  players: { id: string; nick: string }[];
  winnerId: string;
  settings: GameSettings;
  events: ServerLogEvent[];
};

/** Where finished games go, for play-activity stats and future bot training data. Fire-and-forget:
 * a logging failure must never affect the game itself. */
export interface GameLogSink {
  record(entry: GameLogEntry): void;
  close(): Promise<void>;
}

const noopSink: GameLogSink = {
  record() {},
  async close() {},
};

/** Off unless `databaseUrl` is set (e.g. a free Neon/Supabase Postgres instance); see docs/deployment.md. */
export function createGameLogSink(databaseUrl: string | undefined, log: Logger): GameLogSink {
  if (!databaseUrl) return noopSink;
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const ready = pool
    .query(
      `CREATE TABLE IF NOT EXISTS games (
         id bigserial PRIMARY KEY,
         code text NOT NULL,
         started_at timestamptz NOT NULL,
         ended_at timestamptz NOT NULL,
         players jsonb NOT NULL,
         winner_id text NOT NULL,
         settings jsonb NOT NULL,
         events jsonb NOT NULL
       )`,
    )
    .catch((err: unknown) => log.error({ err }, 'game log: failed to ensure schema'));

  return {
    record(entry) {
      void ready
        .then(() =>
          pool.query(
            `INSERT INTO games (code, started_at, ended_at, players, winner_id, settings, events)
             VALUES ($1, to_timestamp($2 / 1000.0), to_timestamp($3 / 1000.0), $4, $5, $6, $7)`,
            [
              entry.code,
              entry.startedAt,
              entry.endedAt,
              JSON.stringify(entry.players),
              entry.winnerId,
              JSON.stringify(entry.settings),
              JSON.stringify(entry.events),
            ],
          ),
        )
        .catch((err: unknown) => log.error({ err, code: entry.code }, 'game log: insert failed'));
    },
    close: () => pool.end(),
  };
}
