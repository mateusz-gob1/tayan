import { describe, expect, it } from 'vitest';
import { iconZoom, pickLayout, seatCardScale } from '../src/lib/scale';

describe('pickLayout', () => {
  it('keeps the base size on laptop-sized windows', () => {
    expect(pickLayout(1024, 768)).toEqual({ rem: 16, cards: 2 });
    expect(pickLayout(1366, 768)).toEqual({ rem: 16, cards: 2 });
  });

  it('grows text smoothly on bigger windows while the cards stay at 2x', () => {
    expect(pickLayout(1920, 1080)).toEqual({ rem: 19, cards: 2 });
    expect(pickLayout(2000, 1000)).toEqual({ rem: 20, cards: 2 });
  });

  it('moves the cards to 3x and 4x only on very big windows', () => {
    expect(pickLayout(2560, 1440).cards).toBe(3);
    expect(pickLayout(3840, 2160)).toEqual({ rem: 28, cards: 4 });
  });

  it('is limited by the smaller of width and height', () => {
    expect(pickLayout(3000, 800).rem).toBe(16);
    expect(pickLayout(1100, 2000).rem).toBe(16);
  });

  it('always gives a whole-number card scale and a whole-pixel font size', () => {
    for (const w of [800, 1280, 1700, 1919, 2500, 3840])
      for (const h of [600, 900, 930, 1250, 2160]) {
        const l = pickLayout(w, h);
        expect(Number.isInteger(l.cards)).toBe(true);
        expect(Number.isInteger(l.rem)).toBe(true);
      }
  });

  it('uses whole-number seat card and icon scales', () => {
    expect(seatCardScale(2)).toBe(1);
    expect(seatCardScale(3)).toBe(1);
    expect(seatCardScale(4)).toBe(2);
    expect(iconZoom(16)).toBe(2);
    expect(iconZoom(20)).toBe(3);
    expect(iconZoom(28)).toBe(4);
  });
});
