import { describe, expect, it } from 'vitest';
import { iconZoom, pickLayout, seatCardScale } from '../src/lib/scale';

describe('pickLayout', () => {
  it('keeps the base size on laptop-sized windows', () => {
    expect(pickLayout(1024, 768)).toEqual({ rem: 16, cards: 2, mode: 'wide' });
    expect(pickLayout(1366, 768)).toEqual({ rem: 16, cards: 2, mode: 'wide' });
  });

  it('grows text smoothly on bigger windows while the cards stay at 2x', () => {
    expect(pickLayout(1920, 1080)).toEqual({ rem: 19, cards: 2, mode: 'wide' });
    expect(pickLayout(2000, 1000)).toEqual({ rem: 20, cards: 2, mode: 'wide' });
  });

  it('moves the cards to 3x and 4x only on very big windows', () => {
    expect(pickLayout(2560, 1440).cards).toBe(3);
    expect(pickLayout(3840, 2160)).toEqual({ rem: 28, cards: 4, mode: 'wide' });
  });

  it('is limited by the smaller of width and height', () => {
    expect(pickLayout(3000, 800).rem).toBe(16);
    expect(pickLayout(1100, 2000).rem).toBe(16);
  });

  it('picks the layout mode from the window shape', () => {
    expect(pickLayout(812, 375).mode).toBe('short'); // phone, sideways
    expect(pickLayout(667, 375).mode).toBe('short');
    expect(pickLayout(390, 844).mode).toBe('portrait'); // phone, upright
    expect(pickLayout(360, 640).mode).toBe('portrait');
    expect(pickLayout(1180, 820).mode).toBe('wide'); // tablet, sideways
    expect(pickLayout(820, 1180).mode).toBe('wide'); // tablet, upright
    expect(pickLayout(1366, 768).mode).toBe('wide');
  });

  it('uses a smaller interface and the smallest cards on phones', () => {
    expect(pickLayout(812, 375)).toEqual({ rem: 13, cards: 1, mode: 'short' });
    expect(pickLayout(390, 844)).toEqual({ rem: 13, cards: 1, mode: 'portrait' });
    expect(pickLayout(320, 568).rem).toBe(12);
    expect(pickLayout(667, 320).rem).toBe(12);
  });

  it('always gives a whole-number card scale and a whole-pixel font size', () => {
    for (const w of [360, 390, 667, 800, 1280, 1700, 1919, 2500, 3840])
      for (const h of [320, 375, 600, 844, 900, 930, 1250, 2160]) {
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
