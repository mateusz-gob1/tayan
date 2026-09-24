import { deckSize } from '../src/deck';
import {
  DECK_TABLE,
  DEFAULT_ELIMINATION_LIMIT,
  chooseDeck,
  defaultStartingCards,
  simulateRates,
} from '../src/deckSelection';
import { seededRng } from '../src/rng';
import type { Rank } from '../src/types';

const games = Number(process.argv[2] ?? 1000);
const rng = seededRng(2026);

console.log(`Deck table (${games} games per variant)\n`);
console.log('players | lowest | cards | avg in play | four % | straight flush % | table');
for (let players = 2; players <= 13; players++) {
  const params = {
    players,
    startingCards: defaultStartingCards(players),
    eliminationLimit: DEFAULT_ELIMINATION_LIMIT,
  };
  const choice = chooseDeck(params, { games, rng, forceSimulation: true });
  const r = simulateRates({ ...params, lowestRank: choice.lowestRank as Rank, games }, rng);
  const tabled = DECK_TABLE[players]?.lowestRank;
  console.log(
    [
      String(players).padStart(7),
      String(choice.lowestRank).padStart(6),
      String(deckSize(choice.lowestRank)).padStart(5),
      r.avgCardsInPlay.toFixed(1).padStart(11),
      (r.fourRate * 100).toFixed(0).padStart(6),
      (r.straightFlushRate * 100).toFixed(0).padStart(16),
      `${tabled}${choice.warning ? ' (warning)' : ''}`,
    ].join(' | '),
  );
}
