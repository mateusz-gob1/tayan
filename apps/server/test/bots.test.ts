import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBot, seededRng } from '@tayan/engine';
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

async function lobby(nicks: string[]) {
  const r = await createRoom(ts.url, nicks);
  open.push(...r.clients);
  return r;
}

describe('bots in a room', () => {
  it('the host can add bots; they show up as connected bots with unique names', async () => {
    const { host } = await lobby(['Ala']);
    await host.ok('room:addBot');
    await host.ok('room:addBot');
    await host.until(() => host.state?.members.length === 3);
    const bots = host.state!.members.filter((m) => m.bot);
    expect(bots.map((b) => b.nick)).toEqual(['Bot 1', 'Bot 2']);
    expect(bots.every((b) => b.connected && !b.spectator)).toBe(true);
    expect(host.state!.hostId).toBe(host.id);
  });

  it('only the host may add bots, only in the lobby, and the room limit applies', async () => {
    const { clients, host } = await lobby(['Ala', 'Bob']);
    expect(await clients[1]!.call('room:addBot')).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });
    await host.ok('room:addBot');
    await host.ok('game:start');
    expect(await host.call('room:addBot')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PHASE' },
    });

    const full = await lobby(Array.from({ length: 13 }, (_, i) => `p${i}`));
    expect(await full.host.call('room:addBot')).toMatchObject({
      ok: false,
      error: { code: 'ROOM_FULL' },
    });
  });

  it('can be switched off with ENABLE_BOTS=false', async () => {
    await ts.stop();
    ts = await startTestServer({ enableBots: false });
    const { host } = await lobby(['Ala']);
    expect(await host.call('room:addBot')).toMatchObject({
      ok: false,
      error: { code: 'NOT_ALLOWED' },
    });
  });

  it('a bot can be removed with kick and never becomes the host', async () => {
    const { host } = await lobby(['Ala']);
    await host.ok('room:addBot');
    await host.until(() => host.state?.members.length === 2);
    host.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(ts.server.rooms.get(host.state!.code)!.hostId).toBe(host.id);

    const other = await createRoom(ts.url, ['Cyd']);
    open.push(...other.clients);
    await other.host.ok('room:addBot');
    await other.host.until(() => other.host.state?.members.length === 2);
    const bot = other.host.state!.members.find((m) => m.bot)!;
    await other.host.ok('room:kick', { playerId: bot.id });
    await other.host.until(() => other.host.state?.members.length === 1);
  });

  it('a human and two bots play a whole game and start a rematch', async () => {
    const { host } = await lobby(['Ala']);
    await host.ok('room:addBot');
    await host.ok('room:addBot');
    await host.ok('room:settings', { eliminationLimit: 3 });
    await host.until(() => host.state?.members.length === 3);
    await host.ok('game:start');
    await host.until(() => host.view?.phase === 'BIDDING');
    const human = randomBot(seededRng(5));

    for (let step = 0; step < 4000 && host.view!.phase !== 'GAME_OVER'; step++) {
      const before = host.views.length;
      const view = host.view!;
      if (view.phase === 'REVEAL') {
        ts.scheduler.advance(REVEAL_MS + 50); // bots do not wait, the timer moves on
      } else if (
        view.currentTurn === host.id &&
        !view.players.find((p) => p.id === host.id)!.eliminated
      ) {
        const intent = human.decide(view);
        await host.ok(intent.type === 'CHECK' ? 'game:check' : 'game:declare', intent);
      } else {
        ts.scheduler.advance(2100); // a bot is thinking
      }
      await host.until(() => host.views.length > before || host.view!.phase === 'GAME_OVER');
    }

    expect(host.view!.phase).toBe('GAME_OVER');
    expect(host.view!.eliminatedOrder).toHaveLength(2);
    // bot views never leak: the human only ever saw its own cards while bidding
    for (const v of host.views.filter((x) => x.phase === 'BIDDING')) {
      const mine = v.players.find((p) => p.id === host.id)!;
      if (!mine.eliminated) expect(v.myCards).toHaveLength(mine.cardCount);
    }

    await host.ok('game:rematch');
    await host.until(() => host.state?.phase === 'LOBBY');
    expect(host.state!.members.filter((m) => m.bot)).toHaveLength(2);
    await host.ok('game:start');
    await host.until(() => host.view?.phase === 'BIDDING');
  });
});
