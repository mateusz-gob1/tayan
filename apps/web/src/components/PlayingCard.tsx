import type { Card } from '@tayan/engine';
import { formatCard } from '@tayan/engine';
import { CARD_H, CARD_W, backSprite, cardSprite, type BackColor } from '../lib/cards';
import { useStore } from '../store';

/** Whole-number zoom of the 56x80 sprites; fractional zoom would blur the pixels. */
export type Scale = 1 | 2 | 3;

// never let flexbox squeeze a sprite: a fractional width would resample the pixels unevenly
const pixelated = { imageRendering: 'pixelated', flexShrink: 0 } as const;

export function PlayingCard({
  card,
  scale = 2,
  highlight = false,
  dim = false,
}: {
  card: Card;
  scale?: Scale;
  highlight?: boolean;
  dim?: boolean;
}) {
  const fourColors = useStore((s) => s.fourColors);
  return (
    <img
      src={cardSprite(card, fourColors)}
      alt={formatCard(card)}
      width={CARD_W * scale}
      height={CARD_H * scale}
      draggable={false}
      className="block select-none"
      style={{
        ...pixelated,
        boxShadow: highlight ? '0 0 0 4px var(--color-gold)' : undefined,
        transform: highlight ? 'translateY(-4px)' : undefined,
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
export function EmptySlot({ label, scale = 2 }: { label: string; scale?: Scale }) {
  return (
    <div
      className="flex items-center justify-center p-1 text-center font-label text-[0.6rem] leading-tight text-cream/70"
      style={{
        width: CARD_W * scale,
        height: CARD_H * scale,
        border: '4px dashed var(--color-cream)',
        opacity: 0.8,
      }}
    >
      {label}
    </div>
  );
}
