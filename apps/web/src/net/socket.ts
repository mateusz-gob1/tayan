import { io, type Socket } from 'socket.io-client';
import type { PlayerView } from '@tayan/engine';
import { loadSession, saveNick, useStore } from '../store';
import type { Ack, RoomState, ServerEvent, Session } from './types';

export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001';

let socket: Socket | null = null;
let pendingNick = '';

/** Room code from an invite link like /r/K7XQM, if any. */
export function codeFromUrl(): string | null {
  const m = /^\/r\/([A-Za-z0-9]{5})\/?$/.exec(window.location.pathname);
  return m ? (m[1] as string).toUpperCase() : null;
}

function setUrl(path: string): void {
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
}

export function request<T = unknown>(event: string, payload: unknown = {}): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: { code: 'INTERNAL' } });
    socket.timeout(10_000).emit(event, payload, (err: Error | null, ack: Ack<T>) => {
      resolve(err ? { ok: false, error: { code: 'INTERNAL' } } : ack);
    });
  });
}

/** Opens the connection once; re-joins the saved room on every (re)connect. */
export function connect(): void {
  if (socket) return;
  const store = useStore.getState;
  socket = io(SERVER_URL, { reconnectionDelayMax: 3000 });

  socket.on('connect', () => {
    store().setConn('connected');
    const saved = loadSession();
    if (!saved) return;
    void request('room:join', {
      code: saved.roomCode,
      nick: saved.nick,
      sessionToken: saved.sessionToken,
    }).then((res) => {
      if (res.ok) return;
      store().clearRoom();
      store().setNotice(res.error.code);
      setUrl('/');
    });
  });
  socket.on('disconnect', () => store().setConn('reconnecting'));
  socket.on('connect_error', () => {
    if (!store().everConnected) store().setConn('waking');
  });

  socket.on('session', (s: Session) => {
    const nick = pendingNick || loadSession()?.nick || '';
    store().setSession({ ...s, nick });
    setUrl(`/r/${s.roomCode}`);
  });
  socket.on('room:state', (r: RoomState) => store().setRoom(r));
  socket.on('game:view', (v: PlayerView) => store().setView(v));
  socket.on('game:event', (e: ServerEvent) => store().pushEvent(e));
  socket.on('error', (e: { code: string }) => {
    if (e.code === 'KICKED') {
      store().clearRoom();
      setUrl('/');
    }
    store().setNotice(e.code);
  });
}

export async function createRoom(nick: string): Promise<Ack> {
  pendingNick = nick;
  saveNick(nick);
  useStore.getState().setNotice(null);
  return request('room:create', { nick });
}

export async function joinRoom(code: string, nick: string): Promise<Ack> {
  pendingNick = nick;
  saveNick(nick);
  useStore.getState().setNotice(null);
  return request('room:join', { code: code.trim().toUpperCase(), nick });
}

export async function leaveRoom(): Promise<void> {
  await request('room:leave');
  useStore.getState().clearRoom();
  setUrl('/');
}
