export type ServerConfig = {
  port: number;
  /** Origin(s) allowed to open WebSocket connections (CORS); several may be comma-separated. */
  clientOrigin: string;
  logLevel: string;
  /** Max client events per second per connection. */
  rateLimitPerSec: number;
  /** Lets the host add server-driven bots to a room (testing aid; set ENABLE_BOTS=false to hide). */
  enableBots: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    clientOrigin: env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    logLevel: env.LOG_LEVEL ?? 'info',
    rateLimitPerSec: Number(env.RATE_LIMIT_PER_SEC ?? 10),
    enableBots: env.ENABLE_BOTS !== 'false',
  };
}

/** Splits the `CLIENT_ORIGIN` setting into a list; `*` allows any origin (tests and local use only). */
export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
