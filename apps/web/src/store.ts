import { create } from 'zustand';
import type { PlayerView } from '@tayan/engine';
import type { RoomState, ServerEvent, Session } from './net/types';

export type ConnState = 'connecting' | 'waking' | 'connected' | 'reconnecting';

export type LogEntry = { id: number; event: ServerEvent };

const SESSION_KEY = 'tayan.session';
const NICK_KEY = 'tayan.nick';
const FOUR_COLORS_KEY = 'tayan.fourColors';

export type StoredSession = Session & { nick: string };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable */
  }
}

export const loadSession = () => read<StoredSession>(SESSION_KEY);
export const saveSession = (s: StoredSession | null) => write(SESSION_KEY, s);
export const loadNick = () => read<string>(NICK_KEY) ?? '';
export const saveNick = (nick: string) => write(NICK_KEY, nick);

type State = {
  conn: ConnState;
  everConnected: boolean;
  session: StoredSession | null;
  room: RoomState | null;
  view: PlayerView | null;
  log: LogEntry[];
  /** Error code shown on the start screen (kicked, room gone, ...). */
  notice: string | null;
  helpOpen: boolean;
  /** Show diamonds in orange and clubs in blue (easier to tell apart than red/black). */
  fourColors: boolean;
  setConn: (c: ConnState) => void;
  setSession: (s: StoredSession | null) => void;
  setRoom: (r: RoomState | null) => void;
  setView: (v: PlayerView | null) => void;
  pushEvent: (e: ServerEvent) => void;
  setNotice: (n: string | null) => void;
  setHelpOpen: (open: boolean) => void;
  setFourColors: (on: boolean) => void;
  /** Forget the current room (after leaving, being kicked, or a failed rejoin). */
  clearRoom: () => void;
};

let logId = 0;

export const useStore = create<State>()((set) => ({
  conn: 'connecting',
  everConnected: false,
  session: loadSession(),
  room: null,
  view: null,
  log: [],
  notice: null,
  helpOpen: false,
  fourColors: read<boolean>(FOUR_COLORS_KEY) === true,
  setConn: (conn) => set((s) => ({ conn, everConnected: s.everConnected || conn === 'connected' })),
  setSession: (session) => {
    saveSession(session);
    set({ session });
  },
  setRoom: (room) => set({ room }),
  setView: (view) => set({ view }),
  pushEvent: (event) => set((s) => ({ log: [...s.log.slice(-49), { id: ++logId, event }] })),
  setNotice: (notice) => set({ notice }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setFourColors: (fourColors) => {
    write(FOUR_COLORS_KEY, fourColors);
    set({ fourColors });
  },
  clearRoom: () => {
    saveSession(null);
    set({ session: null, room: null, view: null, log: [] });
  },
}));

/** Nick lookup that also works for players who have left the room list. */
export function nickOf(view: PlayerView | null, room: RoomState | null, id: string): string {
  return (
    view?.players.find((p) => p.id === id)?.nick ??
    room?.members.find((m) => m.id === id)?.nick ??
    id
  );
}
