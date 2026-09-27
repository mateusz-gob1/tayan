import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBot, seededRng } from '@tayan/engine';
import { REVEAL_MS } from '../src/room';
import type { GameLogEntry, GameLogSink } from '../src/gameLog';
import { TestClient, createRoom, startTestServer, type TestServer } from './helpers';

let ts: TestServer;
let open: TestClient[] = [];
let recorded: GameLogEntry[] = [];

function fakeSink(): GameLogSink {
  return {
    record: (entry) => void recorded.push(entry),
    close: () => Promise.resolve(),
  };
}

beforeEach(() => {
  recorded = [];
});
afterEach(async () => {
  open.forEach((c) => c.close());
  await ts.stop();
});

async function playToGameOver(clients: TestClient[]): Promise<void> {
  const bot = randomBot(seededRng(7));
  const turnOf = () => clients.find((c) => c.id === clients[0]!.view!.currentTurn)!;
  for (let guard = 0; guard < 500 && clients[0]!.view!.phase !== 'GAME_OVER'; guard++) {
    if (clients[0]!.view!.phase === 'REVEAL') {
      const round = clients[0]!.view!.roundNumber;
      await Promise.all(clients.map((c) => c.call('game:ready')));
      await clients[0]!.until(
        () => clients[0]!.view!.roundNumber > round || clients[0]!.view!.phase === 'GAME_OVER',
      );
      continue;
    }
    const actor = turnOf();
    const intent = bot.decide(actor.view!);
    const counts = clients.map((c) => c.views.length);
    await actor.ok(intent.type === 'CHECK' ? 'game:check' : 'game:declare', intent);
    await clients[0]!.until(() => clients.every((c, i) => c.views.length > counts[i]!));
  }
}

describe('the completed-game log', () => {
  it('records a finished game with no bots, with the full round-by-round transcript', async () => {
    ts = await startTestServer({}, { gameLog: fakeSink() });
    const { clients, host } = await createRoom(ts.url, ['Ala', 'Bob', 'Cyd']);
    open = clients;
    await host.ok('game:start');
    await clients[0]!.until(() => clients.every((c) => c.view?.phase === 'BIDDING'));
    await playToGameOver(clients);

    expect(clients.every((c) => c.view!.phase === 'GAME_OVER')).toBe(true);
    expect(recorded).toHaveLength(1);
    const entry = recorded[0]!;
    expect(entry.players.map((p) => p.nick).sort()).toEqual(['Ala', 'Bob', 'Cyd']);
    expect(entry.winnerId).toBe(clients[0]!.view!.winner);
    expect(entry.endedAt).toBeGreaterThanOrEqual(entry.startedAt);
    // a full transcript: every round dealt, declared/checked, and revealed
    expect(entry.events.some((e) => e.type === 'ROUND_STARTED')).toBe(true);
    expect(entry.events.some((e) => e.type === 'REVEALED')).toBe(true);
    expect(entry.events.some((e) => e.type === 'GAME_OVER')).toBe(true);
  });

  it('does not record a game that includes a bot', async () => {
    ts = await startTestServer({}, { gameLog: fakeSink() });
    const { clients, host } = await createRoom(ts.url, ['Ala']);
    open = clients;
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
        ts.scheduler.advance(REVEAL_MS + 50);
      } else if (
        view.currentTurn === host.id &&
        !view.players.find((p) => p.id === host.id)!.eliminated
      ) {
        const intent = human.decide(view);
        await host.ok(intent.type === 'CHECK' ? 'game:check' : 'game:declare', intent);
      } else {
        ts.scheduler.advance(2100);
      }
      await host.until(() => host.views.length > before || host.view!.phase === 'GAME_OVER');
    }

    expect(host.view!.phase).toBe('GAME_OVER');
    expect(recorded).toHaveLength(0);
  });
});
