import { useSyncExternalStore } from 'react';

/** Whole-number size of one "art pixel": fonts, borders and card sprites all grow in these steps. */
export type ArtScale = 2 | 3 | 4;

/**
 * Picks the biggest scale whose layout still fits the window without scrolling. Integer steps keep
 * pixel art crisp (fractional zoom would blur it), so a larger window jumps 2 -> 3 -> 4 and the
 * table simply gets more room in between.
 */
export function pickScale(width: number, height: number): ArtScale {
  if (width >= 2500 && height >= 1250) return 4;
  if (width >= 1700 && height >= 930) return 3;
  return 2;
}

let current: ArtScale = 2;
const listeners = new Set<() => void>();

function apply(): void {
  const next = pickScale(window.innerWidth, window.innerHeight);
  document.documentElement.style.setProperty('--s', String(next));
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}

/** Call once before the first render: sets `--s` on the root and follows window resizes. */
export function initScale(): void {
  apply();
  window.addEventListener('resize', apply);
}

export function useArtScale(): ArtScale {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Card backs at the seats: whole-number scale, smaller than the hand so the table stays roomy. */
export function seatCardScale(scale: ArtScale): 1 | 2 {
  return scale >= 4 ? 2 : 1;
}
