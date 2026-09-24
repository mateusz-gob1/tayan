export type ServerConfig = {
  port: number;
  /** Only this origin may open WebSocket connections (CORS). */
  clientOrigin: string;
  logLevel: string;
  /** Max client events per second per connection. */
  rateLimitPerSec: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    clientOrigin: env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    logLevel: env.LOG_LEVEL ?? 'info',
    rateLimitPerSec: Number(env.RATE_LIMIT_PER_SEC ?? 10),
  };
}
