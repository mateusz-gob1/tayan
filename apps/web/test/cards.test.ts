import { describe, expect, it } from 'vitest';
import { RANKS, SUITS } from '@tayan/engine';
import { backSprite, cardSprite, spriteCount, spriteName } from '../src/lib/cards';

describe('card sprites', () => {
  it('has a sprite for every card', () => {
    for (const rank of RANKS)
      for (const suit of SUITS)
        expect(cardSprite({ rank, suit }), spriteName({ rank, suit })).toBeTruthy();
  });

  it('bundles 52 faces and 4 backs', () => {
    expect(spriteCount).toBe(56);
    for (const c of ['red', 'blue', 'orange', 'green'] as const) expect(backSprite(c)).toBeTruthy();
  });

  it('names a face by rank and suit', () => {
    expect(spriteName({ rank: 12, suit: 'D' })).toBe('12D');
    expect(spriteName({ rank: 14, suit: 'S' })).toBe('14S');
  });
});
