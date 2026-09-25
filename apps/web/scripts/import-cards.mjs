// One-time import of the "Pixel Art Playing Cards" by Kerenel (CC0), https://kerenel.itch.io/pixelart-cards
// Usage: extract kerenel_Cards_seperated.zip somewhere, then
//   node scripts/import-cards.mjs <folder-with-the-extracted-PNGs>
// The 84 files are numbered row by row, 14 per row: [back or template, A, 2..10, J, Q, K].
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/import-cards.mjs <folder-with-extracted-PNGs>');
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/cards');
mkdirSync(out, { recursive: true });

const file = (i) => join(src, `${String(i).padStart(2, '0')}_kerenel_Cards.png`);
const copy = (i, name) => {
  if (!existsSync(file(i))) throw new Error(`missing ${file(i)}`);
  copyFileSync(file(i), join(out, name));
};

// rows: hearts, spades, diamonds, clubs (the sheet also has high-contrast diamonds and clubs after
// these, which the game does not use)
const rows = [
  { suit: 'H', suffix: '' },
  { suit: 'S', suffix: '' },
  { suit: 'D', suffix: '' },
  { suit: 'C', suffix: '' },
];
// ranks as used by the engine (11=J ... 14=A): the file order is A, 2..10, J, Q, K
const ranks = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

rows.forEach(({ suit, suffix }, row) => {
  ranks.forEach((rank, k) => copy(row * 14 + 1 + k, `${rank}${suit}${suffix}.png`));
});
copy(28, 'back-red.png');
copy(42, 'back-blue.png');
copy(56, 'back-orange.png');
copy(70, 'back-green.png');
console.log(`Imported 78 faces and 4 backs into ${out}`);
