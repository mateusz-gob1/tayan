import pino from 'pino';
import { loadConfig } from './config';
import { createGameServer } from './server';

const config = loadConfig();
const log = pino({ level: config.logLevel });
const server = createGameServer(config, { logger: log });

server.listen().then((port) => {
  log.info({ port, clientOrigin: config.clientOrigin }, 'Tayan server listening');
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log.info({ signal }, 'shutting down');
    void server.shutdown().then(() => process.exit(0));
  });
}
