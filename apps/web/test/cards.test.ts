import { describe, expect, it } from 'vitest';
import { RANKS, SUITS } from '@tayan/engine';
import { backSprite, cardSprite, spriteCount, spriteName } from '../src/lib/cards';

describe('card sprites', () => {
  it('has a sprite for every card in both colour modes', () => {
    for (const rank of RANKS)
      for (const suit of SUITS)
        for (const four of [false, true])
          expect(cardSprite({ rank, suit }, four), spriteName({ rank, suit }, four)).toBeTruthy();
  });

  it('bundles 78 faces and 4 backs', () => {
    expect(spriteCount).toBe(82);
    for (const c of ['red', 'blue', 'orange', 'green'] as const) expect(backSprite(c)).toBeTruthy();
  });

  it('four-colour mode only changes diamonds and clubs', () => {
    expect(spriteName({ rank: 12, suit: 'D' }, true)).toBe('12D-hc');
    expect(spriteName({ rank: 12, suit: 'C' }, true)).toBe('12C-hc');
    expect(spriteName({ rank: 12, suit: 'H' }, true)).toBe('12H');
    expect(spriteName({ rank: 12, suit: 'S' }, true)).toBe('12S');
    expect(spriteName({ rank: 12, suit: 'D' }, false)).toBe('12D');
  });

  it('uses different files for the two colour modes of diamonds', () => {
    expect(cardSprite({ rank: 5, suit: 'D' }, true)).not.toBe(
      cardSprite({ rank: 5, suit: 'D' }, false),
    );
  });
});
