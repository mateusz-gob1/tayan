import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CODE_ALPHABET } from '../src/codes';
import { EMPTY_ROOM_MS } from '../src/roomManager';
import { LOBBY_GRACE_MS } from '../src/room';
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
const track = (cs: TestClient[]) => (open.push(...cs), cs);

describe('rooms and lobby', () => {
  it('serves /healthz', async () => {
    const res = await fetch(`${ts.url}/healthz`);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('creates a room with a valid code and returns a session', async () => {
    const { code, clients } = await createRoom(ts.url, ['Ala']);
    track(clients);
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    expect(clients[0]!.session?.sessionToken).toMatch(/^[0-9a-f]{32}$/);
    expect(clients[0]!.state).toMatchObject({ code, hostId: clients[0]!.id, phase: 'LOBBY' });
  });

  it('lets others join (case-insensitive code) and shows everyone in room:state', async () => {
    const { code, clients, host } = await createRoom(ts.url, ['Ala', 'Bob']);
    track(clients);
    const late = track([await TestClient.connect(ts.url)])[0]!;
    await late.ok('room:join', { code: code.toLowerCase(), nick: 'Cyd' });
    await host.until(() => host.state?.members.length === 3);
    expect(host.state!.members.map((m) => m.nick)).toEqual(['Ala', 'Bob', 'Cyd']);
  });

  it('rejects bad input and unknown rooms with the right codes', async () => {
    const { code, clients } = await createRoom(ts.url, ['Ala']);
    track(clients);
    const c = track([await TestClient.connect(ts.url)])[0]!;
    expect(await c.call('room:join', { code: 'ZZZZZ', nick: 'X' })).toMatchObject({
      ok: false,
      error: { code: 'ROOM_NOT_FOUND' },
    });
    expect(await c.call('room:join', { code, nick: 'ala' })).toMatchObject({
      ok: false,
      error: { code: 'NICK_TAKEN' },
    });
    expect(await c.call('room:create', { nick: '' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(await c.call('room:create', { nick: 'x'.repeat(17) })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(await c.call('room:settings', { eliminationLimit: 5 })).toMatchObject({
      ok: false,
      error: { code: 'NOT_IN_ROOM' },
    });
    expect(await c.call('game:declare', { declarationId: 5 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
  });

  it('rejects a 14th member with ROOM_FULL', async () => {
    const nicks = Array.from({ length: 13 }, (_, i) => `p${i}`);
    const { code, clients } = await createRoom(ts.url, nicks);
    track(clients);
    const extra = track([await TestClient.connect(ts.url)])[0]!;
    expect(await extra.call('room:join', { code, nick: 'late' })).toMatchObject({
      ok: false,
      error: { code: 'ROOM_FULL' },
    });
  });

  it('only the host may change settings, start and kick; settings are validated', async () => {
    const { clients, host } = await createRoom(ts.url, ['Ala', 'Bob', 'Cyd']);
    track(clients);
    const bob = clients[1]!;
    expect(await bob.call('room:settings', { eliminationLimit: 4 })).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    expect(await bob.call('game:start')).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    expect(await bob.call('room:kick', { playerId: host.id })).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    expect(await host.call('room:settings', { eliminationLimit: 9 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    await host.ok('room:settings', { eliminationLimit: 4, turnTimerSec: 30 });
    await bob.until(() => bob.state?.settings.eliminationLimit === 4);
    expect(bob.state!.overrides).toEqual({ eliminationLimit: 4, turnTimerSec: 30 });
  });

  it('recomputes automatic settings as players join until the host overrides them', async () => {
    const { code, clients, host } = await createRoom(ts.url, ['a', 'b']);
    track(clients);
    expect(host.state!.settings.lowestRank).toBe(9);
    for (const nick of ['c', 'd', 'e', 'f']) {
      const c = track([await TestClient.connect(ts.url)])[0]!;
      await c.ok('room:join', { code, nick });
    }
    await host.until(() => host.state?.members.length === 6);
    expect(host.state!.settings.lowestRank).toBe(5); // auto: 6 players use a deck from 5
    await host.ok('room:settings', { deckMode: 'FULL' });
    await host.until(() => host.state?.settings.lowestRank === 2);
  });

  it('kicks a member in the lobby and tells them why', async () => {
    const { clients, host } = await createRoom(ts.url, ['Ala', 'Bob']);
    track(clients);
    const bob = clients[1]!;
    await host.ok('room:kick', { playerId: bob.id });
    await bob.until(() => bob.errors.some((e) => e.code === 'KICKED'));
    await host.until(() => host.state?.members.length === 1);
  });

  it('passes the host role on when the host leaves', async () => {
    const { clients, host } = await createRoom(ts.url, ['Ala', 'Bob']);
    track(clients);
    const bob = clients[1]!;
    await host.ok('room:leave');
    await bob.until(() => bob.state?.members.length === 1);
    expect(bob.state!.hostId).toBe(bob.id);
  });

  it('removes a disconnected lobby member after the grace period, keeps them before', async () => {
    const { clients, host } = await createRoom(ts.url, ['Ala', 'Bob']);
    track(clients);
    clients[1]!.close();
    await host.until(() => host.state?.members.some((m) => !m.connected) === true);
    ts.scheduler.advance(LOBBY_GRACE_MS - 1000);
    expect(host.state!.members).toHaveLength(2);
    ts.scheduler.advance(2000);
    await host.until(() => host.state?.members.length === 1);
  });

  it('deletes an empty room after 10 minutes', async () => {
    const { clients, code } = await createRoom(ts.url, ['Ala']);
    clients[0]!.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(ts.server.rooms.get(code)).toBeDefined();
    ts.scheduler.advance(EMPTY_ROOM_MS + 1000);
    expect(ts.server.rooms.get(code)).toBeUndefined();
  });

  it('rate limits noisy connections', async () => {
    await ts.stop();
    ts = await startTestServer({ rateLimitPerSec: 3 });
    const c = track([await TestClient.connect(ts.url)])[0]!;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => c.call('room:join', { code: 'ZZZZZ', nick: 'x' })),
    );
    expect(results.some((r) => !r.ok && r.error.code === 'RATE_LIMITED')).toBe(true);
  });
});
