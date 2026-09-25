import { useArtScale } from '../lib/scale';
import { SuitIcon } from './SuitIcon';

/** Faint suits scattered around the page, only visible on wide screens. */
export function BackdropSuits() {
  const zoom = useArtScale() * 4;
  const spots = [
    { suit: 'S', left: '6%', top: '18%' },
    { suit: 'H', left: '14%', top: '58%' },
    { suit: 'D', left: '9%', top: '80%' },
    { suit: 'C', left: '90%', top: '22%' },
    { suit: 'H', left: '84%', top: '62%' },
    { suit: 'S', left: '92%', top: '84%' },
  ] as const;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-0 hidden opacity-[0.07] lg:block"
    >
      {spots.map((p, i) => (
        <span key={i} className="absolute" style={{ left: p.left, top: p.top }}>
          <SuitIcon suit={p.suit} size={7 * zoom} />
        </span>
      ))}
    </div>
  );
}

/** A strip with the four suits between dashed rules, top and bottom of the panel. */
export function SuitStrip() {
  const size = 7 * useArtScale();
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="pixel-rule flex-1" />
      <SuitIcon suit="S" size={size} />
      <SuitIcon suit="H" size={size} />
      <SuitIcon suit="C" size={size} />
      <SuitIcon suit="D" size={size} />
      <span className="pixel-rule flex-1" />
    </div>
  );
}
