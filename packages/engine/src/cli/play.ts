import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomInt } from 'node:crypto';
import {
  applyAction,
  createGame,
  formatCard,
  formatDeclaration,
  formatSlot,
  toPlayerView,
  type Lang,
  type PlayerView,
} from '../index';

const rl = createInterface({ input: stdin, output: stdout });
const rng = { int: (n: number) => randomInt(n) };
const lang: Lang = process.argv.includes('--en') ? 'en' : 'pl';

async function main(): Promise<void> {
  console.log('Tayan: local hot-seat game (Ctrl+C to quit)\n');
  const n = Number((await rl.question('Number of players (2-13): ')) || 3);
  const ids = Array.from({ length: n }, (_, i) => `P${i + 1}`);
  let { state } = createGame(ids, {}, { rng });
  const s = state.settings;
  console.log(
    `Deck from ${s.lowestRank}, ${s.startingCards} starting card(s), elimination at ${s.eliminationLimit}.`,
  );
  console.log(`Seating: ${state.seating.join(' → ')}`);

  const name = (id: string) => id;
  const showBids = (v: PlayerView) =>
    v.bids.length
      ? v.bids
          .map(
            (b) =>
              `  ${name(b.playerId)}: ${formatDeclaration(
                state.declarations.find((d) => d.id === b.declarationId)!,
                lang,
              )}`,
          )
          .join('\n')
      : '  (no bids yet)';

  while (!state.winner) {
    if (state.round.phase === 'BIDDING') {
      const me = state.round.currentTurn;
      console.clear();
      const view = toPlayerView(state, me);
      console.log(
        `Round ${view.roundNumber}. ${view.players.map((p) => `${p.id}:${p.cardCount}${p.eliminated ? '✗' : ''}`).join('  ')}`,
      );
      console.log(`Bids:\n${showBids(view)}`);
      await rl.question(`\n${me}, press Enter to see your cards (others look away)...`);
      console.log(`Your cards: ${view.myCards.map(formatCard).join(' ')}`);
      const list = state.declarations.slice(view.allowedDeclarationMinOrder);
      for (;;) {
        const ans = (
          await rl.question(
            `[c]heck${view.canCheck ? '' : ' (n/a)'} | [m]inimal raise | [l]ist next 15 | or an id (e.g. PAIR:12): `,
          )
        ).trim();
        try {
          if (ans === 'l') {
            list
              .slice(0, 15)
              .forEach((d) => console.log(`  ${d.id}  ${formatDeclaration(d, lang)}`));
            continue;
          }
          if (ans === 'c')
            ({ state } = applyAction(state, { type: 'CHECK', playerId: me }, { rng }));
          else {
            const id = ans === 'm' ? list[0]?.id : ans;
            ({ state } = applyAction(
              state,
              { type: 'DECLARE', playerId: me, declarationId: id ?? '' },
              { rng },
            ));
          }
          break;
        } catch (e) {
          console.log(`Illegal: ${(e as Error).message}`);
        }
      }
    } else {
      const r = state.round.result!;
      const d = state.declarations.find((x) => x.id === r.declarationId)!;
      console.log(
        `\n=== REVEAL: ${formatDeclaration(d, lang)} (${r.declarerId}) checked by ${r.checkerId}`,
      );
      for (const [p, cards] of Object.entries(r.allHands))
        console.log(`  ${p}: ${cards.map(formatCard).join(' ')}`);
      console.log(
        r.existed
          ? `  Exists → ${r.loserId} gets a card.`
          : `  Missing: ${r.missingSlots.map((m) => formatSlot(m, lang)).join(', ')} → ${r.loserId} gets a card.`,
      );
      if (r.loserEliminated) console.log(`  ${r.loserId} is eliminated!`);
      if (!state.winner) {
        await rl.question('Enter for next round...');
        ({ state } = applyAction(state, { type: 'NEXT_ROUND' }, { rng }));
      }
    }
  }
  console.log(`\nWinner: ${state.winner}. Elimination order: ${state.eliminated.join(', ')}`);
  rl.close();
}

void main();
