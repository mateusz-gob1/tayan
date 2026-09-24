import { createServer, type Server as HttpServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import pino, { type Logger } from 'pino';
import type { Rng } from '@tayan/engine';
import type { ZodError } from 'zod';
import type { ServerConfig } from './config';
import {
  clientEvents,
  RoomError,
  type Ack,
  type ClientEvent,
  type Payload,
  type SessionPayload,
} from './protocol';
import { RateLimiter } from './rateLimit';
import type { Member, Room, Transport } from './room';
import { RoomManager } from './roomManager';
import { realScheduler, type Scheduler } from './scheduler';

type AppSocket = Socket;

export type GameServer = {
  httpServer: HttpServer;
  io: Server;
  rooms: RoomManager;
  listen(port?: number): Promise<number>;
  /** Tells players the server is going down, then closes. */
  shutdown(graceMs?: number): Promise<void>;
  close(): Promise<void>;
};

export type ServerDeps = { scheduler?: Scheduler; rng?: Rng; logger?: Logger };

const cryptoRng: Rng = { int: (max) => randomInt(max) };

export function createGameServer(config: ServerConfig, deps: ServerDeps = {}): GameServer {
  const log = deps.logger ?? pino({ level: config.logLevel });
  const scheduler = deps.scheduler ?? realScheduler;

  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404).end();
  });

  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin },
    // a ping every 25 s doubles as the heartbeat that keeps a free-tier host awake
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  const transport: Transport = {
    toRoom: (code, event, payload) => void io.to(code).emit(event, payload),
    toSocket: (id, event, payload) => void io.to(id).emit(event, payload),
    join: (id, code) => void io.sockets.sockets.get(id)?.join(code),
    leave: (id, code) => void io.sockets.sockets.get(id)?.leave(code),
    drop: (id) => void io.sockets.sockets.get(id)?.disconnect(true),
  };

  const rooms = new RoomManager({ transport, scheduler, rng: deps.rng ?? cryptoRng, log });

  function bind(socket: AppSocket, room: Room, member: Member): SessionPayload {
    socket.data.roomCode = room.code;
    socket.data.memberId = member.id;
    const session = { playerId: member.id, sessionToken: member.token, roomCode: room.code };
    socket.emit('session', session);
    return session;
  }

  function current(socket: AppSocket): { room: Room; member: Member } {
    const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
    const member = room?.memberBySocket(socket.id);
    if (!room || !member) throw new RoomError('NOT_IN_ROOM');
    return { room, member };
  }

  function leaveCurrent(socket: AppSocket): void {
    const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
    const member = room?.memberBySocket(socket.id);
    if (room && member) {
      room.leave(member.id);
      rooms.touch(room);
    }
    socket.data.roomCode = undefined;
    socket.data.memberId = undefined;
  }

  io.on('connection', (rawSocket) => {
    const socket: AppSocket = rawSocket;
    const limiter = new RateLimiter(config.rateLimitPerSec);
    log.debug({ id: socket.id }, 'connected');

    /** Registers a handler: rate limit, zod validation, error mapping, ack. */
    function on<E extends ClientEvent>(event: E, fn: (payload: Payload<E>) => unknown): void {
      (socket as { on(ev: string, l: (...a: unknown[]) => void): unknown }).on(
        event,
        (raw?: unknown, maybeAck?: unknown) => {
          const ack: ((a: Ack<unknown>) => void) | undefined =
            typeof raw === 'function'
              ? (raw as (a: Ack<unknown>) => void)
              : typeof maybeAck === 'function'
                ? (maybeAck as (a: Ack<unknown>) => void)
                : undefined;
          const input = typeof raw === 'function' ? {} : (raw ?? {});
          const fail = (code: RoomError['code'], message?: string) =>
            ack?.({ ok: false, error: { code, ...(message ? { message } : {}) } });

          if (!limiter.allow()) return fail('RATE_LIMITED');
          const parsed = clientEvents[event].safeParse(input);
          if (!parsed.success) {
            return fail('INVALID_PAYLOAD', summarize(parsed.error));
          }
          try {
            const data = fn(parsed.data as Payload<E>);
            ack?.(data === undefined ? { ok: true } : { ok: true, data });
          } catch (e) {
            if (e instanceof RoomError)
              return fail(e.code, e.message === e.code ? undefined : e.message);
            log.error({ err: e, event }, 'unhandled error in handler');
            fail('INTERNAL');
          }
        },
      );
    }

    on('room:create', ({ nick }) => {
      leaveCurrent(socket);
      const room = rooms.create();
      const member = room.addMember(nick, socket.id);
      rooms.touch(room);
      log.info({ code: room.code }, 'room created');
      return bind(socket, room, member);
    });

    on('room:join', ({ code, nick, sessionToken }) => {
      const room = rooms.get(code);
      if (!room) throw new RoomError('ROOM_NOT_FOUND');
      const existing = room.memberBySocket(socket.id);
      if (existing) return bind(socket, room, existing);
      if (socket.data.roomCode) leaveCurrent(socket);
      const rebound = sessionToken ? room.rebind(sessionToken, socket.id) : undefined;
      const member = rebound ?? room.addMember(nick, socket.id);
      rooms.touch(room);
      return bind(socket, room, member);
    });

    on('room:leave', () => leaveCurrent(socket));

    on('room:settings', (settings) => {
      const { room, member } = current(socket);
      room.setSettings(member.id, settings);
    });

    on('room:kick', ({ playerId }) => {
      const { room, member } = current(socket);
      room.kick(member.id, playerId);
      rooms.touch(room);
    });

    on('game:start', () => {
      const { room, member } = current(socket);
      room.start(member.id);
    });
    on('game:declare', ({ declarationId }) => {
      const { room, member } = current(socket);
      room.declare(member.id, declarationId);
    });
    on('game:check', () => {
      const { room, member } = current(socket);
      room.check(member.id);
    });
    on('game:ready', () => {
      const { room, member } = current(socket);
      room.markReady(member.id);
    });
    on('game:rematch', () => {
      const { room, member } = current(socket);
      room.rematch(member.id);
    });
    on('game:voteKick', ({ playerId }) => {
      const { room, member } = current(socket);
      room.voteKick(member.id, playerId);
    });

    socket.on('disconnect', () => {
      const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
      if (room) {
        room.handleDisconnect(socket.id);
        rooms.touch(room);
      }
      log.debug({ id: socket.id }, 'disconnected');
    });
  });

  return {
    httpServer,
    io,
    rooms,
    listen(port = config.port) {
      return new Promise((resolve) => {
        httpServer.listen(port, () => {
          const address = httpServer.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    async shutdown(graceMs = 1000) {
      io.emit('error', { code: 'SERVER_SHUTDOWN' });
      await new Promise((r) => setTimeout(r, graceMs));
      await this.close();
    },
    async close() {
      rooms.closeAll();
      await io.close();
    },
  };
}

function summarize(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`).join('; ');
}
