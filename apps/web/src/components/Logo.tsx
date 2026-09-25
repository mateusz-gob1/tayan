import logoUrl from '../assets/logo.png';
import { useArtScale } from '../lib/scale';

const LOGO_W = 155;
const LOGO_H = 62;

function path(rows: string[]): string {
  let d = '';
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g))
      d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return d;
}

/**
 * The pixel-art logo, always at a whole-number zoom. `big` (the start screen) is one step larger
 * than the cards, so a logo pixel is as thick as the borders around it; the header uses 1x.
 */
export function LogoImage({ big = false }: { big?: boolean }) {
  const art = useArtScale();
  const zoom = big ? art + 1 : art >= 4 ? 2 : 1;
  return (
    <img
      src={logoUrl}
      alt="Tayan"
      width={LOGO_W * zoom}
      height={LOGO_H * zoom}
      style={{ imageRendering: 'pixelated' }}
    />
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
