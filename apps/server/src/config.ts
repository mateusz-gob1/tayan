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

/**
 * Turns the parsed origins into matchers for the CORS layer. An entry like
 * `https://*.example.pages.dev` matches a single subdomain label (Cloudflare Pages preview URLs).
 */
export function originMatchers(origins: string[]): (string | RegExp)[] {
  return origins.map((o) => {
    if (o === '*' || !o.includes('*')) return o;
    const pattern = o
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[a-z0-9-]+');
    return new RegExp(`^${pattern}$`, 'i');
  });
}
