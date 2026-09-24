import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import pl from '../src/i18n/pl.json';

/** Flattens nested JSON into dotted keys, folding plural forms (key_one, key_few, ...) into one key. */
function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
const fold = (list: string[]) =>
  [...new Set(list.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort();

describe('translations', () => {
  it('PL and EN have identical key sets', () => {
    expect(fold(keys(pl))).toEqual(fold(keys(en)));
  });

  it('has no empty strings', () => {
    const empty = (o: unknown): boolean =>
      typeof o === 'string' ? o.trim() === '' : Object.values(o as object).some(empty);
    expect(empty(pl)).toBe(false);
    expect(empty(en)).toBe(false);
  });

  it('every interpolation placeholder in PL exists in EN', () => {
    const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    const flat = (o: unknown, p = ''): Record<string, string> =>
      typeof o === 'string'
        ? { [p]: o }
        : Object.assign(
            {},
            ...Object.entries(o as object).map(([k, v]) => flat(v, p ? `${p}.${k}` : k)),
          );
    const a = flat(pl);
    const b = flat(en);
    for (const [k, v] of Object.entries(a)) {
      const other = b[k.replace(/_(few|many)$/, '_other')] ?? b[k];
      if (other) expect(vars(other), k).toEqual(vars(v));
    }
  });
});
