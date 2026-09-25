import { useSyncExternalStore } from 'react';

export type CardScale = 1 | 2 | 3 | 4;

/**
 * How the screens are arranged: `wide` is the desktop and tablet layout, `short` a low window such
 * as a phone held sideways, `portrait` a narrow tall one such as a phone held upright.
 */
export type LayoutMode = 'wide' | 'short' | 'portrait';

export type Layout = {
  /** Root font size in px: text, spacing and borders scale with it (smoothly). */
  rem: number;
  /** Zoom of the card sprites: whole numbers only, otherwise pixels get resampled unevenly. */
  cards: CardScale;
  mode: LayoutMode;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * TUNING: these numbers decide how big the game is. In the `wide` layout `rem` follows the window
 * (a hundredth of the width, or a 48th of the height if that is smaller) between 16 and 28 px; the
 * cards jump to 3x and 4x only on really big windows. The phone layouts use a smaller `rem`
 * (12 to 16 px) and the smallest cards (1x).
 */
export function pickLayout(width: number, height: number): Layout {
  if (width < 700 && height > width)
    return { rem: clamp(Math.floor(width / 28), 12, 16), cards: 1, mode: 'portrait' };
  if (height < 560) return { rem: clamp(Math.floor(height / 28), 12, 16), cards: 1, mode: 'short' };
  const rem = clamp(Math.floor(Math.min(width / 100, height / 48)), 16, 28);
  const cards: CardScale = rem >= 27 ? 4 : rem >= 24 ? 3 : 2;
  return { rem, cards, mode: 'wide' };
}

let current: Layout = pickLayout(1366, 768);
const listeners = new Set<() => void>();

function apply(): void {
  const next = pickLayout(window.innerWidth, window.innerHeight);
  document.documentElement.style.fontSize = `${next.rem}px`;
  if (next.rem !== current.rem || next.cards !== current.cards || next.mode !== current.mode) {
    current = next;
    listeners.forEach((l) => l());
  }
}

/** Call once before the first render: sets the root font size and follows window resizes. */
export function initScale(): void {
  apply();
  window.addEventListener('resize', apply);
}

function useLayout(): Layout {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export const useLayoutScale = useLayout;

/** Which arrangement the screens use (see `LayoutMode`). */
export function useLayoutMode(): LayoutMode {
  return useLayout().mode;
}

/** Zoom of the hand and reveal cards (1 to 4). */
export function useArtScale(): CardScale {
  return useLayout().cards;
}

/** Card backs at the seats: whole-number scale, smaller than the hand so the table stays roomy. */
export function seatCardScale(scale: CardScale): 1 | 2 {
  return scale >= 4 ? 2 : 1;
}

/** Size multiplier for 7px and 11px pixel icons so they match the text size (whole numbers). */
export function iconZoom(rem: number): number {
  return Math.max(2, Math.round(rem / 8));
}
