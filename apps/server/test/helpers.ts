import pino from 'pino';
import { io as connect, type Socket } from 'socket.io-client';
import { seededRng, type PlayerView } from '@tayan/engine';
import type { Ack, RoomStatePayload, SessionPayload } from '../src/protocol';
import { ManualScheduler } from '../src/scheduler';
import { createGameServer, type GameServer } from '../src/server';
import type { ServerConfig } from '../src/config';

export type TestServer = {
  server: GameServer;
  scheduler: ManualScheduler;
  url: string;
  stop: () => Promise<void>;
};

export async function startTestServer(config: Partial<ServerConfig> = {}): Promise<TestServer> {
  const scheduler = new ManualScheduler();
  const server = createGameServer(
    { port: 0, clientOrigin: '*', logLevel: 'silent', rateLimitPerSec: 1000, ...config },
    { scheduler, rng: seededRng(42), logger: pino({ level: 'silent' }) },
  );
  const port = await server.listen(0);
  return { server, scheduler, url: `http://localhost:${port}`, stop: () => server.close() };
}

export class TestClient {
  views: PlayerView[] = [];
  states: RoomStatePayload[] = [];
  events: { type: string; [k: string]: unknown }[] = [];
  errors: { code: string }[] = [];
  session?: SessionPayload;

  private constructor(readonly socket: Socket) {
    socket.on('game:view', (v: PlayerView) => this.views.push(v));
    socket.on('room:state', (s: RoomStatePayload) => this.states.push(s));
    socket.on('game:event', (e: { type: string }) => this.events.push(e));
    socket.on('error', (e: { code: string }) => this.errors.push(e));
    socket.on('session', (s: SessionPayload) => (this.session = s));
  }

  static connect(url: string): Promise<TestClient> {
    const socket = connect(url, { transports: ['websocket'], forceNew: true });
    const client = new TestClient(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(client));
      socket.once('connect_error', reject);
    });
  }

  get view(): PlayerView | undefined {
    return this.views[this.views.length - 1];
  }
  get state(): RoomStatePayload | undefined {
    return this.states[this.states.length - 1];
  }
  get id(): string {
    return this.session!.playerId;
  }

  call<T = unknown>(event: string, payload: unknown = {}): Promise<Ack<T>> {
    return new Promise((resolve) => this.socket.emit(event, payload, resolve));
  }

  async ok<T = unknown>(event: string, payload: unknown = {}): Promise<T | undefined> {
    const res = await this.call<T>(event, payload);
    if (!res.ok) throw new Error(`${event} failed: ${res.error.code} ${res.error.message ?? ''}`);
    return res.data;
  }

  async until(pred: () => boolean, ms = 3000): Promise<void> {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error('timed out waiting for condition');
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  close(): void {
    this.socket.close();
  }
}

/** Creates a room with the given nicks; the first one is the host. */
export async function createRoom(url: string, nicks: string[]) {
  const clients: TestClient[] = [];
  const host = await TestClient.connect(url);
  const created = await host.ok<SessionPayload>('room:create', { nick: nicks[0] });
  clients.push(host);
  for (const nick of nicks.slice(1)) {
    const c = await TestClient.connect(url);
    await c.ok('room:join', { code: created!.roomCode, nick });
    clients.push(c);
  }
  await host.until(() => host.state?.members.length === nicks.length);
  return { code: created!.roomCode, clients, host };
}
