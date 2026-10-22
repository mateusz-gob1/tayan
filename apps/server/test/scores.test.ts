import { afterEach, describe, expect, it } from 'vitest';
import { randomBot, seededRng } from '@tayan/engine';
import { TestClient, createRoom, startTestServer, type TestServer } from './helpers';

let ts: TestServer;
let open: TestClient[] = [];
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

describe('session scores', () => {
  it('first out gets 0, each next one more, and points add up over rematches', async () => {
    ts = await startTestServer();
    const { clients, host } = await createRoom(ts.url, ['Ala', 'Bob', 'Cyd']);
    open = clients;
    expect(host.state!.scores).toEqual([]);

    await host.ok('game:start');
    await clients[0]!.until(() => clients.every((c) => c.view?.phase === 'BIDDING'));
    await playToGameOver(clients);
    await host.until(() => host.state?.phase === 'GAME_OVER' && host.state.scores.length === 3);

    const view = clients[0]!.view!;
    const byId = new Map(host.state!.scores.map((r) => [r.id, r]));
    expect(byId.get(view.eliminatedOrder[0]!)).toMatchObject({ points: 0, gained: 0 });
    expect(byId.get(view.eliminatedOrder[1]!)).toMatchObject({ points: 1, gained: 1 });
    expect(byId.get(view.winner!)).toMatchObject({ points: 2, gained: 2 });
    expect(host.state!.scores[0]!.id).toBe(view.winner);

    await host.ok('game:rematch');
    await host.ok('game:start');
    await clients[0]!.until(() => clients.every((c) => c.view?.phase === 'BIDDING'));
    await playToGameOver(clients);
    await host.until(() => host.state?.phase === 'GAME_OVER');
    const total = host.state!.scores.reduce((sum, r) => sum + r.points, 0);
    expect(total).toBe(6); // 0 + 1 + 2 per game, two games
  });
});
