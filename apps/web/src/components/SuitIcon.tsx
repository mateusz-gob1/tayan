import type { Suit } from '@tayan/engine';
import { useStore } from '../store';

// 7x7 bitmaps; '#' is a filled pixel. Drawn as SVG rects, so they stay crisp at any whole-number size.
const BITMAPS: Record<Suit, string[]> = {
  H: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  D: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  C: ['..###..', '.#####.', '..###..', '##.#.##', '#######', '...#...', '..###..'],
  S: ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'],
};

function path(rows: string[]): string {
  let d = '';
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g))
      d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return d;
}

const PATHS = Object.fromEntries(
  (Object.keys(BITMAPS) as Suit[]).map((s) => [s, path(BITMAPS[s])]),
) as Record<Suit, string>;

const SYMBOL_TO_SUIT: Record<string, Suit> = { '♣': 'C', '♦': 'D', '♥': 'H', '♠': 'S' };

/** Colour of a suit on the dark UI: red hearts/diamonds; orange/blue in four-colour mode. */
function suitColor(suit: Suit, fourColors: boolean): string {
  if (suit === 'H') return 'var(--color-card-red)';
  if (suit === 'D') return fourColors ? 'var(--color-card-orange)' : 'var(--color-card-red)';
  if (suit === 'C') return fourColors ? 'var(--color-card-blue)' : 'currentColor';
  return 'currentColor';
}

export function SuitIcon({ suit, size = 14 }: { suit: Suit; size?: number }) {
  const fourColors = useStore((s) => s.fourColors);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="inline-block align-[-0.15em]"
      style={{ color: undefined }}
    >
      <path d={PATHS[suit]} fill={suitColor(suit, fourColors)} />
    </svg>
  );
}

/** Text in which the suit characters (♣ ♦ ♥ ♠) are replaced by pixel icons that match the font. */
export function SuitText({ text, size = 14 }: { text: string; size?: number }) {
  const parts = text.split(/([♣♦♥♠])/);
  return (
    <>
      {parts.map((part, i) => {
        const suit = SYMBOL_TO_SUIT[part];
        return suit ? <SuitIcon key={i} suit={suit} size={size} /> : <span key={i}>{part}</span>;
      })}
    </>
  );
}
