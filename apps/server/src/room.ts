import { randomBytes, randomUUID } from 'node:crypto';
import {
  activePlayers,
  applyAction,
  createGame,
  randomBot,
  resolveSettings,
  toPlayerView,
  MAX_PLAYERS,
  type Action,
  type GameEvent,
  type GameSettings,
  type GameState,
  type PlayerMeta,
  type Rng,
} from '@tayan/engine';
import { chooseDeck } from '@tayan/engine';
import type { Logger } from 'pino';
import { RoomError, toRoomError, type RoomPhase, type RoomStatePayload } from './protocol';
import type { Scheduler } from './scheduler';

export const REVEAL_MS = 10_000;
export const LOBBY_GRACE_MS = 60_000;

export type Member = {
  id: string;
  nick: string;
  token: string;
  socketId: string | null;
  /** Server-driven test player; has no socket and always counts as connected. */
  bot?: boolean;
  joinedAt: number;
  role: 'player' | 'spectator';
  disconnectedAt: number | null;
};

/** How a room talks to connected sockets; implemented on top of Socket.IO in server.ts. */
export interface Transport {
  toRoom(code: string, event: string, payload: unknown): void;
  toSocket(socketId: string, event: string, payload: unknown): void;
  join(socketId: string, code: string): void;
  leave(socketId: string, code: string): void;
  drop(socketId: string): void;
}

export type RoomDeps = {
  transport: Transport;
  scheduler: Scheduler;
  rng: Rng;
  log: Logger;
};

type Reason = 'VOTE' | 'INACTIVE' | 'LEFT' | 'KICKED';

export class Room {
  members: Member[] = [];
  hostId = '';
  phase: RoomPhase = 'LOBBY';
  overrides: Partial<GameSettings> = {};
  state: GameState | null = null;

  private nickById = new Map<string, string>();
  private ready = new Set<string>();
  private kickVotes = new Set<string>();
  private graceCancel = new Map<string, () => void>();
  private joinCounter = 0;

  private timerKey = '';
  private turnStartedAt = 0;
  private turnDeadline: number | undefined;
  private revealEndsAt: number | undefined;
  private cancelTurn: (() => void) | undefined;
  private cancelReveal: (() => void) | undefined;
  private cancelInactive: (() => void) | undefined;
  private cancelBot: (() => void) | undefined;
  private botTimerKey = '';

  constructor(
    readonly code: string,
    private readonly deps: RoomDeps,
  ) {}

  // ---- membership -------------------------------------------------------

  member(id: string): Member | undefined {
    return this.members.find((m) => m.id === id);
  }

  memberBySocket(socketId: string): Member | undefined {
    return this.members.find((m) => m.socketId === socketId);
  }

  /** Humans need a live socket; bots are always online. */
  private online(m: Member): boolean {
    return m.bot === true || m.socketId !== null;
  }

  connectedCount(): number {
    return this.members.filter((m) => m.socketId !== null).length;
  }

  addMember(nick: string, socketId: string): Member {
    const clean = nick.trim();
    if (this.members.some((m) => m.nick.toLowerCase() === clean.toLowerCase()))
      throw new RoomError('NICK_TAKEN');
    if (this.members.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL');
    const member: Member = {
      id: randomUUID().slice(0, 8),
      nick: clean,
      token: randomBytes(16).toString('hex'),
      socketId,
      joinedAt: ++this.joinCounter,
      // joining a running game makes you a spectator until the rematch
      role: this.phase === 'PLAYING' ? 'spectator' : 'player',
      disconnectedAt: null,
    };
    this.members.push(member);
    this.nickById.set(member.id, member.nick);
    this.deps.transport.join(socketId, this.code);
    this.afterChange();
    return member;
  }

  /** Adds a server-driven bot (host only, lobby only). */
  addBot(byId: string): Member {
    this.requireHost(byId);
    if (this.phase !== 'LOBBY') throw new RoomError('INVALID_PHASE');
    if (this.members.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL');
    let n = 1;
    while (this.members.some((m) => m.nick.toLowerCase() === `bot ${n}`)) n++;
    const bot: Member = {
      id: randomUUID().slice(0, 8),
      nick: `Bot ${n}`,
      token: randomBytes(16).toString('hex'),
      socketId: null,
      joinedAt: ++this.joinCounter,
      role: 'player',
      disconnectedAt: null,
      bot: true,
    };
    this.members.push(bot);
    this.nickById.set(bot.id, bot.nick);
    this.afterChange();
    return bot;
  }

  /** Re-attaches a new socket to an existing member identified by session token. */
  rebind(token: string, socketId: string): Member | undefined {
    const member = this.members.find((m) => m.token === token);
    if (!member) return undefined;
    const old = member.socketId;
    member.socketId = socketId;
    member.disconnectedAt = null;
    this.graceCancel.get(member.id)?.();
    this.graceCancel.delete(member.id);
    if (old && old !== socketId) {
      this.deps.transport.leave(old, this.code);
      this.deps.transport.drop(old);
    }
    this.deps.transport.join(socketId, this.code);
    this.afterChange();
    return member;
  }

  handleDisconnect(socketId: string): void {
    const member = this.memberBySocket(socketId);
    if (!member) return; // already re-bound to a newer socket
    member.socketId = null;
    member.disconnectedAt = this.deps.scheduler.now();
    if (this.phase !== 'PLAYING' || member.role === 'spectator') this.scheduleGrace(member);
    this.afterChange();
  }

  leave(memberId: string): void {
    this.removeMember(memberId, 'LEFT');
    this.afterChange();
  }

  kick(byId: string, targetId: string): void {
    this.requireHost(byId);
    const target = this.member(targetId);
    if (!target || target.id === byId) throw new RoomError('NOT_ALLOWED');
    if (target.socketId) {
      this.deps.transport.toSocket(target.socketId, 'error', { code: 'KICKED' });
    }
    const socketId = target.socketId;
    this.removeMember(targetId, 'KICKED');
    if (socketId) this.deps.transport.drop(socketId);
    this.afterChange();
  }

  private scheduleGrace(member: Member): void {
    this.graceCancel.get(member.id)?.();
    this.graceCancel.set(
      member.id,
      this.deps.scheduler.after(LOBBY_GRACE_MS, () => {
        this.graceCancel.delete(member.id);
        this.removeMember(member.id, 'LEFT');
        this.afterChange();
      }),
    );
  }

  private removeMember(id: string, reason: Reason): void {
    const member = this.member(id);
    if (!member) return;
    this.graceCancel.get(id)?.();
    this.graceCancel.delete(id);
    if (member.socketId) this.deps.transport.leave(member.socketId, this.code);
    this.members = this.members.filter((m) => m.id !== id);
    if (this.state && !this.state.winner && activePlayers(this.state).includes(id)) {
      this.forceEliminate(id, reason);
    }
  }

  private ensureHost(): void {
    const current = this.member(this.hostId);
    if (current?.socketId) return;
    const pick = (list: Member[]) => list.sort((a, b) => a.joinedAt - b.joinedAt)[0];
    const humans = this.members.filter((m) => !m.bot);
    const next = pick(humans.filter((m) => m.socketId)) ?? current ?? pick([...humans]);
    this.hostId = next?.id ?? '';
  }

  private requireHost(memberId: string): void {
    if (memberId !== this.hostId) throw new RoomError('NOT_HOST');
  }

  private requirePlayer(memberId: string): Member {
    const m = this.member(memberId);
    if (!m || m.role !== 'player') throw new RoomError('NOT_ALLOWED');
    return m;
  }

  // ---- lobby ------------------------------------------------------------

  setSettings(memberId: string, partial: Partial<GameSettings>): void {
    this.requireHost(memberId);
    if (this.phase !== 'LOBBY') throw new RoomError('INVALID_PHASE');
    const next = { ...this.overrides, ...partial };
    if (partial.deckMode === 'AUTO' || partial.deckMode === 'FULL') delete next.lowestRank;
    this.overrides = next;
    this.afterChange();
  }

  start(memberId: string): void {
    this.requireHost(memberId);
    if (this.phase !== 'LOBBY') throw new RoomError('INVALID_PHASE');
    const players = this.members.filter((m) => m.role === 'player' && this.online(m));
    if (players.length < 2) throw new RoomError('NOT_ENOUGH_PLAYERS');
    // players who are offline sit out until the rematch
    for (const m of this.members) if (!players.includes(m)) m.role = 'spectator';
    try {
      const result = createGame(
        players.map((p) => p.id),
        this.overrides,
        this.ctx(),
      );
      this.state = result.state;
      this.emitEvents(result.events);
    } catch (e) {
      throw toRoomError(e);
    }
    this.phase = 'PLAYING';
    this.ready.clear();
    this.timerKey = '';
    this.afterChange();
  }

  rematch(memberId: string): void {
    this.requireHost(memberId);
    if (this.phase !== 'GAME_OVER') throw new RoomError('INVALID_PHASE');
    this.state = null;
    this.phase = 'LOBBY';
    this.ready.clear();
    this.kickVotes.clear();
    for (const m of this.members) {
      m.role = 'player';
      if (!this.online(m)) this.scheduleGrace(m);
    }
    this.afterChange();
  }

  // ---- gameplay ---------------------------------------------------------

  declare(memberId: string, declarationId: string): void {
    this.requirePlaying();
    this.requirePlayer(memberId);
    this.run({ type: 'DECLARE', playerId: memberId, declarationId });
    this.afterChange();
  }

  check(memberId: string): void {
    this.requirePlaying();
    this.requirePlayer(memberId);
    this.run({ type: 'CHECK', playerId: memberId });
    this.afterChange();
  }

  /** "Next" click during the reveal. */
  markReady(memberId: string): void {
    const st = this.requirePlaying();
    this.requirePlayer(memberId);
    if (st.winner || st.round.phase !== 'REVEAL' || !activePlayers(st).includes(memberId))
      throw new RoomError('INVALID_PHASE');
    this.ready.add(memberId);
    this.afterChange();
  }

  /** Vote to remove the player whose turn has been idle for `kickVoteAfterSec`. */
  voteKick(memberId: string, targetId: string): void {
    const st = this.requirePlaying();
    this.requirePlayer(memberId);
    const active = activePlayers(st);
    if (st.winner || st.round.phase !== 'BIDDING') throw new RoomError('INVALID_PHASE');
    if (!active.includes(memberId) || memberId === targetId) throw new RoomError('NOT_ALLOWED');
    if (st.round.currentTurn !== targetId) throw new RoomError('NOT_ALLOWED');
    const availableAt = this.turnStartedAt + st.settings.kickVoteAfterSec * 1000;
    if (this.deps.scheduler.now() < availableAt) throw new RoomError('NOT_ALLOWED');
    this.kickVotes.add(memberId);
    const eligible = active.filter((id) => id !== targetId).length;
    if (this.kickVotes.size * 2 > eligible) this.forceEliminate(targetId, 'VOTE');
    this.afterChange();
  }

  private requirePlaying(): GameState {
    if (this.phase !== 'PLAYING' || !this.state) throw new RoomError('INVALID_PHASE');
    return this.state;
  }

  private ctx() {
    return { rng: this.deps.rng, now: this.deps.scheduler.now() };
  }

  private run(action: Action): void {
    if (!this.state) throw new RoomError('INVALID_PHASE');
    try {
      const result = applyAction(this.state, action, this.ctx());
      this.state = result.state;
      this.emitEvents(result.events);
      if (result.state.winner) this.phase = 'GAME_OVER';
    } catch (e) {
      throw toRoomError(e);
    }
  }

  private forceEliminate(playerId: string, reason: Reason): void {
    try {
      this.run({ type: 'ELIMINATE', playerId });
      this.deps.transport.toRoom(this.code, 'game:event', {
        type: 'ELIMINATION_REASON',
        playerId,
        reason,
      });
    } catch (e) {
      this.deps.log.warn({ err: e, playerId, reason }, 'forced elimination failed');
    }
    const m = this.member(playerId);
    if (m) m.role = 'spectator';
  }

  private emitEvents(events: GameEvent[]): void {
    for (const event of events) this.deps.transport.toRoom(this.code, 'game:event', event);
  }

  // ---- timers -----------------------------------------------------------

  private clearTurnTimers(): void {
    this.cancelTurn?.();
    this.cancelReveal?.();
    this.cancelTurn = this.cancelReveal = undefined;
  }

  private syncTimers(): void {
    const st = this.state;
    if (!st || st.winner) {
      this.clearTurnTimers();
      this.cancelInactive?.();
      this.cancelInactive = undefined;
      this.timerKey = '';
      this.turnDeadline = this.revealEndsAt = undefined;
      return;
    }
    const { scheduler } = this.deps;
    const r = st.round;
    const key =
      r.phase === 'REVEAL' ? `R${r.number}` : `B${r.number}:${r.bids.length}:${r.currentTurn}`;
    if (key !== this.timerKey) {
      this.timerKey = key;
      this.clearTurnTimers();
      this.kickVotes.clear();
      this.ready.clear();
      this.turnStartedAt = scheduler.now();
      this.turnDeadline = this.revealEndsAt = undefined;
      if (r.phase === 'REVEAL') {
        this.revealEndsAt = this.turnStartedAt + REVEAL_MS;
        this.cancelReveal = scheduler.after(REVEAL_MS, () => this.guard(() => this.nextRound(key)));
      } else if (st.settings.turnTimerSec) {
        const ms = st.settings.turnTimerSec * 1000;
        this.turnDeadline = this.turnStartedAt + ms;
        this.cancelTurn = scheduler.after(ms, () => this.guard(() => this.autoPlay(key)));
      }
    }
    // waiting for a disconnected player: eliminate after the host-chosen limit
    this.cancelInactive?.();
    this.cancelInactive = undefined;
    const limit = st.settings.inactiveTimeoutSec;
    if (r.phase === 'BIDDING' && limit) {
      const m = this.member(r.currentTurn);
      if (m && !this.online(m)) {
        const since = Math.max(this.turnStartedAt, m.disconnectedAt ?? 0);
        const delay = Math.max(0, since + limit * 1000 - scheduler.now());
        const target = r.currentTurn;
        this.cancelInactive = scheduler.after(delay, () =>
          this.guard(() => {
            if (this.state?.round.currentTurn !== target || this.state.round.phase !== 'BIDDING')
              return;
            this.forceEliminate(target, 'INACTIVE');
          }),
        );
      }
    }
  }

  /** Runs a timer callback, then publishes the result; timers must never throw. */
  private guard(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      this.deps.log.warn({ err: e }, 'timer callback failed');
    }
    this.afterChange();
  }

  private nextRound(key: string): void {
    if (key !== this.timerKey || this.state?.round.phase !== 'REVEAL') return;
    this.run({ type: 'NEXT_ROUND' });
  }

  /** Turn timer expired: check, or the lowest declaration if this player opens the round. */
  private autoPlay(key: string): void {
    const st = this.state;
    if (key !== this.timerKey || !st || st.round.phase !== 'BIDDING') return;
    const playerId = st.round.currentTurn;
    const opening = st.round.bids.length === 0;
    const first = st.declarations[0];
    if (opening && first) this.run({ type: 'DECLARE', playerId, declarationId: first.id });
    else this.run({ type: 'CHECK', playerId });
    this.deps.transport.toRoom(this.code, 'game:event', { type: 'AUTO_PLAYED', playerId });
  }

  /** Schedules the move of a bot whose turn it is, after a human-like pause. */
  private driveBots(): void {
    const st = this.state;
    const turn =
      st && !st.winner && st.round.phase === 'BIDDING'
        ? this.member(st.round.currentTurn)
        : undefined;
    if (!st || !turn?.bot) {
      this.cancelBot?.();
      this.cancelBot = undefined;
      this.botTimerKey = '';
      return;
    }
    const key = `${st.round.number}:${st.round.bids.length}:${turn.id}`;
    if (key === this.botTimerKey) return;
    this.cancelBot?.();
    this.botTimerKey = key;
    const delay = 800 + this.deps.rng.int(1200);
    this.cancelBot = this.deps.scheduler.after(delay, () => this.guard(() => this.botMove(key)));
  }

  private botMove(key: string): void {
    this.botTimerKey = ''; // if the move fails, the next change schedules a new attempt
    const st = this.state;
    if (!st || st.winner || st.round.phase !== 'BIDDING') return;
    const turn = this.member(st.round.currentTurn);
    if (!turn?.bot || `${st.round.number}:${st.round.bids.length}:${turn.id}` !== key) return;
    const intent = randomBot(this.deps.rng).decide(toPlayerView(st, turn.id, this.meta()));
    this.run(
      intent.type === 'CHECK'
        ? { type: 'CHECK', playerId: turn.id }
        : { type: 'DECLARE', playerId: turn.id, declarationId: intent.declarationId },
    );
  }

  private checkReadyAdvance(): void {
    const st = this.state;
    if (!st || st.winner || st.round.phase !== 'REVEAL') return;
    const waiting = activePlayers(st).filter((id) => this.member(id)?.socketId);
    if (waiting.length > 0 && waiting.every((id) => this.ready.has(id))) {
      this.run({ type: 'NEXT_ROUND' });
    }
  }

  // ---- publishing -------------------------------------------------------

  /** Called after every change: fixes the host, advances the game, re-arms timers, broadcasts. */
  private afterChange(): void {
    this.ensureHost();
    try {
      this.checkReadyAdvance();
    } catch (e) {
      this.deps.log.warn({ err: e }, 'ready advance failed');
    }
    this.syncTimers();
    this.driveBots();
    this.broadcast();
  }

  roomState(): RoomStatePayload {
    const playerCount = Math.max(2, this.members.filter((m) => m.role === 'player').length);
    const settings = this.state?.settings ?? resolveSettings(this.overrides, playerCount);
    const deckWarning =
      !this.state && settings.deckMode === 'AUTO'
        ? chooseDeck({
            players: playerCount,
            startingCards: settings.startingCards,
            eliminationLimit: settings.eliminationLimit,
          }).warning
        : false;
    const st = this.state;
    const voting = st && !st.winner && st.round.phase === 'BIDDING';
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      members: this.members.map((m) => ({
        id: m.id,
        nick: m.nick,
        connected: this.online(m),
        bot: m.bot === true,
        spectator: m.role === 'spectator',
      })),
      overrides: this.overrides,
      settings,
      deckWarning,
      readyIds: [...this.ready],
      ...(this.revealEndsAt !== undefined ? { revealEndsAt: this.revealEndsAt } : {}),
      kickVote: voting
        ? {
            targetId: st.round.currentTurn,
            votes: [...this.kickVotes],
            availableAt: this.turnStartedAt + st.settings.kickVoteAfterSec * 1000,
          }
        : null,
    };
  }

  private meta(): PlayerMeta {
    const meta: PlayerMeta = {};
    for (const [id, nick] of this.nickById) meta[id] = { nick, connected: false };
    for (const m of this.members) meta[m.id] = { nick: m.nick, connected: this.online(m) };
    return meta;
  }

  broadcast(): void {
    const { transport } = this.deps;
    transport.toRoom(this.code, 'room:state', this.roomState());
    if (!this.state) return;
    const meta = this.meta();
    for (const m of this.members) {
      if (!m.socketId) continue;
      const view = toPlayerView(this.state, m.id, meta);
      transport.toSocket(m.socketId, 'game:view', {
        ...view,
        ...(this.turnDeadline !== undefined && view.phase === 'BIDDING'
          ? { turnDeadline: this.turnDeadline }
          : {}),
      });
    }
  }

  dispose(): void {
    this.cancelBot?.();
    this.clearTurnTimers();
    this.cancelInactive?.();
    for (const cancel of this.graceCancel.values()) cancel();
    this.graceCancel.clear();
  }
}
