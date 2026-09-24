import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildDeck, deckSize } from '../src/deck';
import { generateDeclarations, isHigher } from '../src/declarations';
import { DEFAULT_CATEGORY_ORDER, type Category, type Rank } from '../src/types';
import { decl } from './helpers';

const cfg = (lowestRank: Rank, categoryOrder: readonly Category[] = DEFAULT_CATEGORY_ORDER) => ({
  lowestRank,
  categoryOrder,
});

describe('deck', () => {
  it('has the expected size', () => {
    expect(buildDeck(9)).toHaveLength(24);
    expect(buildDeck(2)).toHaveLength(52);
    expect(deckSize(5)).toBe(40);
  });
});

describe('generateDeclarations', () => {
  it('counts per category for a deck from 9', () => {
    const list = generateDeclarations(cfg(9));
    const by = (c: Category) => list.filter((d) => d.category === c).length;
    expect(by('HIGH')).toBe(6);
    expect(by('PAIR')).toBe(6);
    expect(by('TWO_PAIR')).toBe(15);
    expect(by('STRAIGHT')).toBe(2); // 9-K and 10-A
    expect(by('THREE')).toBe(6);
    expect(by('FLUSH')).toBe(4);
    expect(by('FULL')).toBe(30);
    expect(by('FOUR')).toBe(6);
    expect(by('STRAIGHT_FLUSH')).toBe(8);
  });

  it('has nine straights in the full deck and no ace-low straight', () => {
    const straights = generateDeclarations(cfg(2)).filter((d) => d.category === 'STRAIGHT');
    expect(straights.map((d) => d.ranks[0])).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('follows the default category order and highest is ace-high straight flush of spades', () => {
    const list = generateDeclarations(cfg(9));
    expect(list[0]?.id).toBe('HIGH:9');
    expect(list[list.length - 1]?.id).toBe('STRAIGHT_FLUSH:14:S');
    const firstOf = (c: Category) => list.findIndex((d) => d.category === c);
    const idx = DEFAULT_CATEGORY_ORDER.map(firstOf);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('orders parameters: two pair by high pair then low; full by trips then pair', () => {
    expect(isHigher(decl('TWO_PAIR:12:9'), decl('TWO_PAIR:12:8'))).toBe(true);
    expect(isHigher(decl('TWO_PAIR:13:2'), decl('TWO_PAIR:12:11'))).toBe(true);
    expect(isHigher(decl('FULL:12:2'), decl('FULL:11:14'))).toBe(true);
    expect(isHigher(decl('FLUSH:S'), decl('FLUSH:H'))).toBe(true);
    expect(isHigher(decl('STRAIGHT_FLUSH:10:C'), decl('STRAIGHT_FLUSH:9:S'))).toBe(true);
    expect(isHigher(decl('STRAIGHT_FLUSH:9:S'), decl('STRAIGHT_FLUSH:9:H'))).toBe(true);
  });

  it('places straight below three of a kind, flush above three, below full', () => {
    expect(isHigher(decl('THREE:2'), decl('STRAIGHT:14'))).toBe(true);
    expect(isHigher(decl('FLUSH:C'), decl('THREE:14'))).toBe(true);
    expect(isHigher(decl('FULL:2:3'), decl('FLUSH:S'))).toBe(true);
  });

  it('honours a custom category order (flush above full)', () => {
    const order: Category[] = [
      'HIGH',
      'PAIR',
      'TWO_PAIR',
      'STRAIGHT',
      'THREE',
      'FULL',
      'FLUSH',
      'FOUR',
      'STRAIGHT_FLUSH',
    ];
    const list = generateDeclarations(cfg(9, order));
    expect(list.findIndex((d) => d.category === 'FLUSH')).toBeGreaterThan(
      list.findIndex((d) => d.category === 'FULL'),
    );
  });

  it('property: list is strictly increasing with unique ids and orders equal indices', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 9 }), (low) => {
        const list = generateDeclarations(cfg(low as Rank));
        expect(new Set(list.map((d) => d.id)).size).toBe(list.length);
        list.forEach((d, i) => expect(d.order).toBe(i));
        for (let i = 1; i < list.length; i++) expect(isHigher(list[i]!, list[i - 1]!)).toBe(true);
      }),
    );
  });
});
