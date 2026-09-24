import { describe, expect, it } from 'vitest';
import { fitCardScale } from '../src/components/RevealBoard';

describe('fitCardScale', () => {
  const rem = 16;

  it('uses the biggest zoom that fits', () => {
    // two players with two cards each in a roomy panel
    expect(fitCardScale([2, 2], { w: 900, h: 400 }, 3, rem)).toBe(3);
  });

  it('steps down when the rows would not fit vertically', () => {
    // three players wrap onto two rows at 2x, which is too tall for a 300 px panel
    expect(fitCardScale([2, 2, 2], { w: 500, h: 300 }, 2, rem)).toBe(1);
    expect(fitCardScale([2, 2, 2], { w: 500, h: 480 }, 2, rem)).toBe(2);
  });

  it('never goes below 1 and never above the maximum', () => {
    expect(fitCardScale([5, 5, 5, 5, 5, 5], { w: 300, h: 100 }, 4, rem)).toBe(1);
    expect(fitCardScale([1], { w: 2000, h: 2000 }, 2, rem)).toBe(2);
  });

  it('starts small before the panel has been measured', () => {
    expect(fitCardScale([2, 2], { w: 0, h: 0 }, 3, rem)).toBe(1);
  });
});
