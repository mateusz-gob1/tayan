import type { Card } from '@tayan/engine';

/** Native size of the Kerenel card sprites (CC0); the UI scales them by whole numbers only. */
export const CARD_W = 56;
export const CARD_H = 80;

const files = import.meta.glob('../assets/cards/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const urls = new Map(
  Object.entries(files).map(([path, url]) => [
    (path.split('/').pop() ?? '').replace('.png', ''),
    url,
  ]),
);

export type BackColor = 'red' | 'blue' | 'orange' | 'green';

/** File name (without extension) of a card face. */
export function spriteName(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function url(name: string): string {
  const found = urls.get(name);
  if (!found) throw new Error(`missing card sprite: ${name}`);
  return found;
}

export const cardSprite = (card: Card): string => url(spriteName(card));
export const backSprite = (color: BackColor = 'red'): string => url(`back-${color}`);

/** Loads every sprite up front so cards never pop in when they are first shown. */
export function preloadCards(): void {
  for (const src of urls.values()) {
    const img = new Image();
    img.src = src;
  }
}

/** Number of card sprites bundled (78 faces and 4 backs); used by tests. */
export const spriteCount = urls.size;
