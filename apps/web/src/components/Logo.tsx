import { iconZoom, useLayoutScale } from '../lib/scale';

// 11x11 spade, drawn as SVG rects so it is exactly the same pixel art at any whole-number size.
const SPADE = [
  '.....#.....',
  '....###....',
  '...#####...',
  '..#######..',
  '.#########.',
  '###########',
  '###########',
  '###########',
  '.##.###.##.',
  '....###....',
  '...#####...',
];

function path(rows: string[]): string {
  let d = '';
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g))
      d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return d;
}

export const SPADE_PATH = path(SPADE);

export function SpadeMark({
  size = 33,
  color = 'var(--color-gold)',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 11 11"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d={SPADE_PATH} fill="var(--color-ink)" transform="translate(0.5 0.5)" />
      <path d={SPADE_PATH} fill={color} />
    </svg>
  );
}

/** Logo: pixel spade and the name in the display font. `big` is for the start screen. */
export function Logo({ big = false }: { big?: boolean }) {
  const { rem } = useLayoutScale();
  const zoom = iconZoom(rem);
  return (
    <span className={`inline-flex items-center gap-3 ${big ? 'gap-5' : ''}`}>
      <SpadeMark size={11 * (big ? zoom * 2 + 2 : zoom)} />
      <span
        className={`font-display uppercase text-gold ${big ? 'text-4xl' : 'text-base'}`}
        style={{ textShadow: big ? '4px 4px 0 var(--color-ink)' : '2px 2px 0 var(--color-ink)' }}
      >
        Tayan
      </span>
    </span>
  );
}

// 11x11 trophy for the end screen
const TROPHY = [
  '.#########.',
  '##.#####.##',
  '##.#####.##',
  '.##.###.##.',
  '..#######..',
  '...#####...',
  '....###....',
  '.....#.....',
  '.....#.....',
  '...#####...',
  '..#######..',
];

export function TrophyMark({ size = 66 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 11 11"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d={path(TROPHY)} fill="var(--color-ink)" transform="translate(0.5 0.5)" />
      <path d={path(TROPHY)} fill="var(--color-gold)" />
    </svg>
  );
}
