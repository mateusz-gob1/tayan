import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORY_ORDER, generateDeclarations, type Declaration } from '@tayan/engine';
import { availableByCategory, nextStep, paramLabelKey } from '../src/lib/declarationTree';

const list = generateDeclarations({ lowestRank: 9, categoryOrder: DEFAULT_CATEGORY_ORDER });
const find = (id: string) => list.find((d) => d.id === id) as Declaration;

describe('availableByCategory', () => {
  it('offers everything at the start and only higher hands afterwards', () => {
    expect(availableByCategory(list, 0).size).toBe(9);
    const after = availableByCategory(list, find('THREE:9').order + 1);
    expect(after.has('HIGH')).toBe(false);
    expect(after.has('TWO_PAIR')).toBe(false);
    expect(after.get('THREE')?.map((d) => d.id)).toEqual([
      'THREE:10',
      'THREE:11',
      'THREE:12',
      'THREE:13',
      'THREE:14',
    ]);
    expect(after.has('FULL')).toBe(true);
  });

  it('offers nothing after the highest declaration', () => {
    expect(availableByCategory(list, list.length).size).toBe(0);
  });
});

describe('nextStep', () => {
  const cat = (c: string, min = 0) => availableByCategory(list, min).get(c as never) ?? [];

  it('single-parameter hand: one rank step, then done', () => {
    const s = nextStep(cat('PAIR'), []);
    expect(s).toMatchObject({ done: false, kind: 'rank', options: [9, 10, 11, 12, 13, 14] });
    expect(nextStep(cat('PAIR'), [12])).toEqual({ done: true, declaration: find('PAIR:12') });
  });

  it('two pair: high pair first, then only lower ranks', () => {
    const s1 = nextStep(cat('TWO_PAIR'), []);
    expect(s1).toMatchObject({ options: [10, 11, 12, 13, 14] }); // 9 cannot be the higher pair
    const s2 = nextStep(cat('TWO_PAIR'), [12]);
    expect(s2).toMatchObject({ kind: 'rank', options: [9, 10, 11] });
    expect(nextStep(cat('TWO_PAIR'), [12, 9])).toEqual({
      done: true,
      declaration: find('TWO_PAIR:12:9'),
    });
  });

  it('full house excludes the trips rank from the pair choice', () => {
    const s = nextStep(cat('FULL'), [12]);
    expect(s).toMatchObject({ options: [9, 10, 11, 13, 14] });
  });

  it('flush picks only a suit, straight flush a rank then a suit (in suit order)', () => {
    expect(nextStep(cat('FLUSH'), [])).toMatchObject({
      kind: 'suit',
      options: ['C', 'D', 'H', 'S'],
    });
    expect(nextStep(cat('STRAIGHT_FLUSH'), [14])).toMatchObject({
      kind: 'suit',
      options: ['C', 'D', 'H', 'S'],
    });
    expect(nextStep(cat('STRAIGHT_FLUSH'), [14, 'S'])).toEqual({
      done: true,
      declaration: find('STRAIGHT_FLUSH:14:S'),
    });
  });

  it('only offers values that still lead to an allowed raise', () => {
    const min = find('FULL:12:9').order + 1; // after "queens full of nines"
    expect(nextStep(cat('FULL', min), [])).toMatchObject({ options: [12, 13, 14] });
    // queens are still allowed as trips, but only with a pair above nines
    expect(nextStep(cat('FULL', min), [12])).toMatchObject({ options: [10, 11, 13, 14] });
    expect(nextStep(cat('FULL', min), [13])).toMatchObject({ options: [9, 10, 11, 12, 14] });
  });

  it('labels the steps for each category', () => {
    expect(paramLabelKey('TWO_PAIR', 0, 'rank')).toBe('high');
    expect(paramLabelKey('TWO_PAIR', 1, 'rank')).toBe('low');
    expect(paramLabelKey('FULL', 0, 'rank')).toBe('trips');
    expect(paramLabelKey('FULL', 1, 'rank')).toBe('pair');
    expect(paramLabelKey('STRAIGHT', 0, 'rank')).toBe('top');
    expect(paramLabelKey('FLUSH', 0, 'suit')).toBe('suit');
    expect(paramLabelKey('PAIR', 0, 'rank')).toBe('rank');
  });
});
