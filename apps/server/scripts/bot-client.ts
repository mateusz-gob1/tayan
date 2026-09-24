/**
 * Development helper: joins a room with N random bots so a game can be tried alone.
 * Usage: pnpm dev:bots ROOMCODE [count=2] [serverUrl=http://localhost:3001]
 * Bots are ordinary WebSocket clients; they only see their own PlayerView.
 */
import { io } from 'socket.io-client';
import { randomBot, seededRng, type PlayerView } from '@tayan/engine';

const [code, countArg, urlArg] = process.argv.slice(2);
if (!code) {
  console.error('Usage: pnpm dev:bots ROOMCODE [count] [serverUrl]');
  process.exit(1);
}
const count = Number(countArg ?? 2);
const url = urlArg ?? 'http://localhost:3001';

const delay = (min: number, max: number) => min + Math.random() * (max - min);

function startBot(index: number): void {
  const nick = `Bot${index + 1}`;
  const bot = randomBot(seededRng(Date.now() + index * 7919));
  const socket = io(url, { transports: ['websocket'] });
  let me = '';
  let acting = false;
  let readyForRound = -1;

  socket.on('connect', () => {
    socket.emit('room:join', { code, nick }, (ack: { ok: boolean; error?: { code: string } }) => {
      if (!ack.ok) console.error(`${nick}: cannot join (${ack.error?.code})`);
      else console.log(`${nick}: joined ${code}`);
    });
  });
  socket.on('session', (s: { playerId: string }) => (me = s.playerId));

  socket.on('game:view', (view: PlayerView) => {
    if (view.phase === 'BIDDING' && view.currentTurn === me && !acting) {
      acting = true;
      setTimeout(
        () => {
          const intent = bot.decide(view);
          socket.emit(intent.type === 'CHECK' ? 'game:check' : 'game:declare', intent);
          acting = false;
        },
        delay(700, 1800),
      );
    }
    if (view.phase === 'REVEAL' && readyForRound !== view.roundNumber) {
      readyForRound = view.roundNumber;
      setTimeout(() => socket.emit('game:ready'), delay(1500, 3500));
    }
  });
  socket.on('error', (e: { code: string }) => console.log(`${nick}: ${e.code}`));
}

for (let i = 0; i < count; i++) startBot(i);
console.log(`Started ${count} bot(s) for room ${code} at ${url}. Ctrl+C to stop.`);
