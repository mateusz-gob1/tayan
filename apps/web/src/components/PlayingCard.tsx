import type { Card } from '@tayan/engine';
import { formatCard } from '@tayan/engine';
import { CARD_H, CARD_W, backSprite, cardSprite, type BackColor } from '../lib/cards';
import { useArtScale } from '../lib/scale';
import { useStore } from '../store';

/** Whole-number zoom of the 56x80 sprites; fractional zoom would blur the pixels. */
export type Scale = 1 | 2 | 3 | 4;

// never let flexbox squeeze a sprite: a fractional width would resample the pixels unevenly
const pixelated = { imageRendering: 'pixelated', flexShrink: 0 } as const;

export function PlayingCard({
  card,
  scale,
  highlight = false,
  dim = false,
}: {
  card: Card;
  scale?: Scale;
  highlight?: boolean;
  dim?: boolean;
}) {
  const fourColors = useStore((s) => s.fourColors);
  const art = useArtScale();
  const s = scale ?? art;
  return (
    <img
      src={cardSprite(card, fourColors)}
      alt={formatCard(card)}
      width={CARD_W * s}
      height={CARD_H * s}
      draggable={false}
      className="block select-none"
      style={{
        ...pixelated,
        boxShadow: highlight ? '0 0 0 var(--b) var(--color-gold)' : undefined,
        transform: highlight ? 'translateY(calc(var(--b) * -1))' : undefined,
        opacity: dim ? 0.4 : 1,
        filter: dim ? 'grayscale(1)' : undefined,
      }}
    />
  );
}

export function CardBack({ scale = 1, color = 'red' }: { scale?: Scale; color?: BackColor }) {
  return (
    <img
      src={backSprite(color)}
      alt=""
      width={CARD_W * scale}
      height={CARD_H * scale}
      draggable={false}
      className="block select-none"
      style={pixelated}
    />
  );
}

/** A gap in a declared hand: a dashed pixel frame the size of a card. */
export function EmptySlot({ label, scale }: { label: string; scale?: Scale }) {
  const art = useArtScale();
  const s = scale ?? art;
  return (
    <div
      className="flex items-center justify-center p-1 text-center font-label text-[0.9rem] leading-tight text-cream/70"
      style={{
        width: CARD_W * s,
        height: CARD_H * s,
        border: 'var(--b) dashed var(--color-cream)',
        opacity: 0.8,
      }}
    >
      {label}
    </div>
  );
}
