import { describe, expect, it } from 'vitest';
import { pickScale, seatCardScale } from '../src/lib/scale';

describe('pickScale', () => {
  it('keeps the base scale on laptop-sized windows', () => {
    expect(pickScale(1024, 768)).toBe(2);
    expect(pickScale(1366, 768)).toBe(2);
    expect(pickScale(1600, 900)).toBe(2);
  });

  it('grows on big windows, in whole steps', () => {
    expect(pickScale(1920, 1080)).toBe(3);
    expect(pickScale(2000, 1000)).toBe(3);
    expect(pickScale(2560, 1440)).toBe(4);
  });

  it('needs both width and height, so a wide but short window stays small', () => {
    expect(pickScale(2560, 800)).toBe(2);
    expect(pickScale(1700, 900)).toBe(2);
  });

  it('only ever returns a whole number', () => {
    for (const w of [800, 1280, 1700, 1919, 2500, 3840])
      for (const h of [600, 900, 930, 1250, 2160])
        expect(Number.isInteger(pickScale(w, h))).toBe(true);
  });

  it('uses whole-number card back scales', () => {
    expect(seatCardScale(2)).toBe(1);
    expect(seatCardScale(3)).toBe(1);
    expect(seatCardScale(4)).toBe(2);
  });
});
