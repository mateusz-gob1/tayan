/** Source of randomness; the server passes a crypto-backed one, tests a seeded one. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** Deterministic RNG (mulberry32) for tests and simulations. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(maxExclusive: number): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(r * maxExclusive);
    },
  };
}

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
