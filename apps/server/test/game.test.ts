import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDeclarations, randomBot, seededRng, type PlayerView } from '@tayan/engine';
import { REVEAL_MS } from '../src/room';
import { TestClient, createRoom, startTestServer, type TestServer } from './helpers';

let ts: TestServer;
let open: TestClient[] = [];
beforeEach(async () => {
  ts = await startTestServer();
  open = [];
});
afterEach(async () => {
  open.forEach((c) => c.close());
  await ts.stop();
});

async function room(nicks: string[], settings: object = {}) {
  const r = await createRoom(ts.url, nicks);
  open.push(...r.clients);
  if (Object.keys(settings).length) await r.host.ok('room:settings', settings);
  return r;
}

/** Waits until every client has the same round/phase view. */
const inPhase = (cs: TestClient[], phase: PlayerView['phase']) =>
  cs[0]!.until(() => cs.every((c) => c.view?.phase === phase));

function turnOf(cs: TestClient[]): TestClient {
  const id = cs[0]!.view!.currentTurn;
  return cs.find((c) => c.id === id)!;
}

describe('a full game over the wire', () => {
  it('3 clients play to a winner; bidding views never leak other hands', async () => {
    const { clients, host } = await room(['Ala', 'Bob', 'Cyd']);
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const bot = randomBot(seededRng(7));
    const seenBidding: { viewer: string; view: PlayerView }[] = [];

    for (let guard = 0; guard < 500; guard++) {
      if (clients[0]!.view!.phase === 'GAME_OVER') break;
      if (clients[0]!.view!.phase === 'REVEAL') {
        const round = clients[0]!.view!.roundNumber;
        await Promise.all(clients.map((c) => c.call('game:ready')));
        await clients[0]!.until(
          () => clients[0]!.view!.roundNumber > round || clients[0]!.view!.phase === 'GAME_OVER',
        );
        continue;
      }
      for (const c of clients) seenBidding.push({ viewer: c.id, view: c.view! });
      const actor = turnOf(clients);
      const intent = bot.decide(actor.view!);
      const counts = clients.map((c) => c.views.length);
      await actor.ok(intent.type === 'CHECK' ? 'game:check' : 'game:declare', intent);
      await clients[0]!.until(() => clients.every((c, i) => c.views.length > counts[i]!));
    }

    expect(clients.every((c) => c.view!.phase === 'GAME_OVER')).toBe(true);
    const winner = clients[0]!.view!.winner!;
    expect(clients.map((c) => c.view!.winner)).toEqual([winner, winner, winner]);
    expect(clients[0]!.view!.eliminatedOrder).toHaveLength(2);
    expect(clients[0]!.view!.lastResult).toBeDefined();

    // every view sent during bidding had no result and only the viewer's own cards
    for (const { view } of seenBidding) {
      if (view.phase !== 'BIDDING') continue;
      expect(view.lastResult).toBeUndefined();
      const mine = view.players.find((p) => p.id === view.me)!;
      if (!mine.eliminated) expect(view.myCards).toHaveLength(mine.cardCount);
    }
    // and the raw stream a client received never contained anyone else's cards while bidding
    for (const c of clients) {
      const others = clients.filter((o) => o !== c);
      for (const v of c.views.filter((x) => x.phase === 'BIDDING')) {
        const round = v.roundNumber;
        for (const o of others) {
          const theirs = o.views.find((x) => x.roundNumber === round && x.phase === 'BIDDING');
          if (!theirs) continue;
          const key = (cs: PlayerView['myCards']) => cs.map((k) => `${k.rank}${k.suit}`);
          for (const card of key(theirs.myCards)) expect(key(v.myCards)).not.toContain(card);
        }
      }
    }
  });

  it('maps engine rule violations to protocol error codes', async () => {
    const { clients, host } = await room(['Ala', 'Bob']);
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const a = turnOf(clients);
    const b = clients.find((c) => c !== a)!;
    const list = getDeclarations(a.view!.settings);
    expect(await b.call('game:declare', { declarationId: list[0]!.id })).toMatchObject({
      ok: false,
      error: { code: 'NOT_YOUR_TURN' },
    });
    expect(await a.call('game:check')).toMatchObject({
      ok: false,
      error: { code: 'NOTHING_TO_CHECK' },
    });
    expect(await a.call('game:declare', { declarationId: 'NOPE' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    await a.ok('game:declare', { declarationId: list[5]!.id });
    expect(await b.call('game:declare', { declarationId: list[2]!.id })).toMatchObject({
      ok: false,
      error: { code: 'BID_TOO_LOW' },
    });
    expect(await b.call('game:ready')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PHASE' },
    });
  });

  it('cannot start with one player or twice', async () => {
    const { clients, host } = await room(['Ala']);
    expect(await host.call('game:start')).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_PLAYERS' },
    });
    const bob = await TestClient.connect(ts.url);
    open.push(bob);
    await bob.ok('room:join', { code: host.state!.code, nick: 'Bob' });
    await host.until(() => host.state?.members.length === 2);
    await host.ok('game:start');
    expect(await host.call('game:start')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PHASE' },
    });
    expect(await host.call('room:settings', { turnTimerSec: 30 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PHASE' },
    });
    expect(clients).toHaveLength(1);
  });
});

describe('spectators, reveal and rematch', () => {
  it('a late joiner is a spectator who sees public info; rematch brings everyone back', async () => {
    const { clients, host, code } = await room(['Ala', 'Bob']);
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');

    const spec = await TestClient.connect(ts.url);
    open.push(spec);
    await spec.ok('room:join', { code, nick: 'Cyd' });
    await spec.until(() => spec.view !== undefined);
    expect(spec.view!.myCards).toEqual([]);
    expect(spec.state!.members.find((m) => m.nick === 'Cyd')!.spectator).toBe(true);
    expect(await spec.call('game:check')).toMatchObject({
      ok: false,
      error: { code: 'NOT_ALLOWED' },
    });

    // play until someone wins by forced elimination of the non-host
    const loser = clients.find((c) => c !== host)!;
    await host.ok('room:kick', { playerId: loser.id });
    await spec.until(() => spec.view?.phase === 'GAME_OVER');
    expect(spec.view!.winner).toBe(host.id);

    await loser.until(() => !loser.socket.connected); // the kicked client is dropped
    await host.ok('game:rematch');
    await spec.until(() => spec.state?.phase === 'LOBBY');
    expect(spec.state!.members.every((m) => !m.spectator)).toBe(true);
    await host.ok('game:start');
    await spec.until(() => spec.view?.phase === 'BIDDING');
    expect(spec.view!.myCards.length).toBeGreaterThan(0);
  });

  it('advances the reveal when all connected players click Next, or after the timeout', async () => {
    const { clients, host } = await room(['Ala', 'Bob']);
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const list = getDeclarations(host.view!.settings);

    const playRound = async () => {
      await inPhase(clients, 'BIDDING');
      const a = turnOf(clients);
      await a.ok('game:declare', { declarationId: list[list.length - 1]!.id });
      await host.until(() => clients.every((c) => c.view!.bids.length === 1));
      await turnOf(clients).ok('game:check');
      await inPhase(clients, 'REVEAL');
    };

    await playRound();
    const round = host.view!.roundNumber;
    expect(host.state!.revealEndsAt).toBeGreaterThan(0);
    await clients[0]!.ok('game:ready');
    await host.until(() => host.state!.readyIds.length === 1);
    expect(host.view!.phase).toBe('REVEAL');
    await clients[1]!.ok('game:ready');
    await host.until(() => host.view!.roundNumber === round + 1);

    await playRound();
    const round2 = host.view!.roundNumber;
    ts.scheduler.advance(REVEAL_MS + 100);
    await host.until(
      () => host.view!.roundNumber === round2 + 1 || host.view!.phase === 'GAME_OVER',
    );
  });
});

describe('reconnect', () => {
  it('re-attaches by session token and resends the current view', async () => {
    const { clients, host, code } = await room(['Ala', 'Bob']);
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const bob = clients[1]!;
    const { playerId, sessionToken } = bob.session!;
    const cards = bob.view!.myCards;

    bob.close();
    await host.until(() => host.view?.players.find((p) => p.id === playerId)?.connected === false);
    expect(host.view!.players.find((p) => p.id === playerId)!.eliminated).toBe(false);

    const again = await TestClient.connect(ts.url);
    open.push(again);
    await again.ok('room:join', { code, nick: 'whatever', sessionToken });
    await again.until(() => again.view !== undefined);
    expect(again.id).toBe(playerId);
    expect(again.view!.myCards).toEqual(cards);
    await host.until(() => host.view?.players.find((p) => p.id === playerId)?.connected === true);
  });

  it('a wrong token does not steal an identity', async () => {
    const { clients, code } = await room(['Ala', 'Bob']);
    const stranger = await TestClient.connect(ts.url);
    open.push(stranger);
    const res = await stranger.call('room:join', {
      code,
      nick: 'Bob',
      sessionToken: 'a'.repeat(32),
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'NICK_TAKEN' } });
    expect(clients).toHaveLength(2);
  });
});

describe('timers', () => {
  it('turn timer: opens with the lowest declaration, then auto-checks', async () => {
    const { clients, host } = await room(['Ala', 'Bob'], { turnTimerSec: 30 });
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    expect(host.view!.turnDeadline).toBe(ts.scheduler.now() + 30_000);

    ts.scheduler.advance(30_100);
    await host.until(() => host.view!.bids.length === 1);
    expect(host.view!.bids[0]!.declarationId).toBe(getDeclarations(host.view!.settings)[0]!.id);
    expect(host.events.some((e) => e.type === 'AUTO_PLAYED')).toBe(true);

    ts.scheduler.advance(30_100);
    await host.until(() => host.view!.phase === 'REVEAL');
    expect(host.view!.lastResult!.checkerId).not.toBe(host.view!.lastResult!.declarerId);
  });

  it('eliminates a disconnected player after the host-configured wait', async () => {
    const { clients, host } = await room(['Ala', 'Bob', 'Cyd'], { inactiveTimeoutSec: 120 });
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const victim = turnOf(clients);
    const rest = clients.filter((c) => c !== victim);
    victim.close();
    await rest[0]!.until(() => rest[0]!.view!.players.some((p) => !p.connected));

    ts.scheduler.advance(119_000);
    expect(rest[0]!.view!.players.find((p) => p.id === victim.id)!.eliminated).toBe(false);
    ts.scheduler.advance(2000);
    await rest[0]!.until(() => rest[0]!.view!.players.find((p) => p.id === victim.id)!.eliminated);
    expect(
      rest[0]!.events.some((e) => e.type === 'ELIMINATION_REASON' && e.reason === 'INACTIVE'),
    ).toBe(true);
    expect(rest[0]!.view!.phase).toBe('BIDDING'); // the game goes on with a fresh round
  });

  it('waits forever by default for a disconnected player', async () => {
    const { clients, host } = await room(['Ala', 'Bob']);
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const victim = turnOf(clients);
    const other = clients.find((c) => c !== victim)!;
    victim.close();
    await other.until(() => other.view!.players.some((p) => !p.connected));
    ts.scheduler.advance(3 * 3600_000);
    expect(other.view!.players.find((p) => p.id === victim.id)!.eliminated).toBe(false);
  });

  it('vote kick: only after the idle limit, needs a majority of the other active players', async () => {
    const { clients, host } = await room(['Ala', 'Bob', 'Cyd', 'Dan'], { kickVoteAfterSec: 60 });
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
    const idle = turnOf(clients);
    const voters = clients.filter((c) => c !== idle);

    expect(await voters[0]!.call('game:voteKick', { playerId: idle.id })).toMatchObject({
      ok: false,
      error: { code: 'NOT_ALLOWED' }, // too early
    });
    ts.scheduler.advance(61_000);
    expect(await idle.call('game:voteKick', { playerId: idle.id })).toMatchObject({ ok: false });
    expect(await voters[2]!.call('game:voteKick', { playerId: voters[1]!.id })).toMatchObject({
      ok: false, // target is not the player on turn
    });

    await voters[0]!.ok('game:voteKick', { playerId: idle.id });
    await host.until(() => host.state?.kickVote?.votes.length === 1);
    expect(host.view!.players.find((p) => p.id === idle.id)!.eliminated).toBe(false); // 1 of 3
    await voters[1]!.ok('game:voteKick', { playerId: idle.id });
    await voters[0]!.until(
      () => voters[0]!.view!.players.find((p) => p.id === idle.id)!.eliminated,
    );
    expect(
      voters[0]!.events.some((e) => e.type === 'ELIMINATION_REASON' && e.reason === 'VOTE'),
    ).toBe(true);
  });
});

describe('the last reveal before the end screen', () => {
  async function toFinalReveal() {
    // 2 players and a limit of 3 cards: whoever loses the first round is out, so the game ends
    const r = await room(['Ala', 'Bob'], { eliminationLimit: 3 });
    await r.host.ok('game:start');
    await inPhase(r.clients, 'BIDDING');
    const list = getDeclarations(r.host.view!.settings);
    await turnOf(r.clients).ok('game:declare', { declarationId: list[list.length - 1]!.id });
    await r.host.until(() => r.clients.every((c) => c.view!.bids.length === 1));
    await turnOf(r.clients).ok('game:check');
    await inPhase(r.clients, 'REVEAL');
    return r;
  }

  it('keeps the reveal on screen, without announcing the winner yet', async () => {
    const { clients, host } = await toFinalReveal();
    for (const c of clients) {
      expect(c.view!.lastResult).toBeDefined();
      expect(c.view!.winner).toBeUndefined();
    }
    expect(host.state!.phase).toBe('PLAYING');
    expect(host.events.some((e) => e.type === 'GAME_OVER')).toBe(false);
    expect(host.events.some((e) => e.type === 'PLAYER_ELIMINATED')).toBe(true);
  });

  it('shows the end screen once everyone who played the round has skipped', async () => {
    const { clients, host } = await toFinalReveal();
    await clients[0]!.ok('game:ready'); // the loser is eliminated but may still skip
    await host.until(() => host.state!.readyIds.length === 1);
    expect(host.view!.phase).toBe('REVEAL');
    await clients[1]!.ok('game:ready');
    await inPhase(clients, 'GAME_OVER');
    expect(host.view!.winner).toBeDefined();
    expect(host.state!.phase).toBe('GAME_OVER');
    expect(host.events.some((e) => e.type === 'GAME_OVER')).toBe(true);
  });

  it('shows the end screen after the reveal time even if nobody skips', async () => {
    const { clients, host } = await toFinalReveal();
    ts.scheduler.advance(REVEAL_MS - 100);
    expect(host.view!.phase).toBe('REVEAL');
    ts.scheduler.advance(200);
    await inPhase(clients, 'GAME_OVER');
    expect(host.view!.winner).toBeDefined();
  });

  it('a rematch works after the end screen', async () => {
    const { clients, host } = await toFinalReveal();
    ts.scheduler.advance(REVEAL_MS + 100);
    await inPhase(clients, 'GAME_OVER');
    await host.ok('game:rematch');
    await host.until(() => host.state?.phase === 'LOBBY');
    await host.ok('game:start');
    await inPhase(clients, 'BIDDING');
  });
});
