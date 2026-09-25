import { useEffect, useState } from 'react';
import type { Card } from '@tayan/engine';
import { formatCard } from '@tayan/engine';
import { CARD_H, CARD_W, backSprite, cardSprite, type BackColor } from '../lib/cards';
import { useArtScale } from '../lib/scale';
import { useStore } from '../store';

/** Whole-number zoom of the 56x80 sprites; fractional zoom would blur the pixels. */
export type Scale = 1 | 2 | 3 | 4;

// never let flexbox squeeze a sprite: a fractional width would resample the pixels unevenly
const pixelated = { imageRendering: 'pixelated', flexShrink: 0 } as const;

/** The four frames of a card turning over: back, edge of the back, edge of the face, face. */
type FlipPhase = 'back' | 'closing' | 'opening' | 'face';
const FLIP_HALF_MS = 65;

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Drives the flip with timers instead of CSS keyframes, so the card always ends up face up even if
 * the browser pauses animations (a hidden tab, an occluded window) while it is turning.
 */
function useFlipPhase(delay: number | undefined): FlipPhase {
  const [phase, setPhase] = useState<FlipPhase>(
    delay === undefined || reducedMotion() ? 'face' : 'back',
  );
  useEffect(() => {
    if (delay === undefined || reducedMotion()) return;
    const timers = [
      window.setTimeout(() => setPhase('closing'), delay),
      window.setTimeout(() => setPhase('opening'), delay + FLIP_HALF_MS),
      window.setTimeout(() => setPhase('face'), delay + 2 * FLIP_HALF_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [delay]);
  return phase;
}

export function PlayingCard({
  card,
  scale,
  highlight = false,
  dim = false,
  flipDelay,
}: {
  card: Card;
  scale?: Scale;
  highlight?: boolean;
  dim?: boolean;
  /** If set, the card is shown face down first and turns over after this many ms. */
  flipDelay?: number;
}) {
  const fourColors = useStore((s) => s.fourColors);
  const art = useArtScale();
  const phase = useFlipPhase(flipDelay);
  const s = scale ?? art;
  const w = CARD_W * s;
  const h = CARD_H * s;

  if (phase !== 'face') {
    // while turning, show the card edge-on: half the width (a whole number of pixels) and centred
    const half = phase === 'closing' || phase === 'opening';
    const src = phase === 'opening' ? cardSprite(card, fourColors) : backSprite('red');
    return (
      <div className="flex items-center justify-center" style={{ width: w, height: h }}>
        <img
          src={src}
          alt=""
          width={half ? w / 2 : w}
          height={h}
          draggable={false}
          className="block select-none"
          style={pixelated}
        />
      </div>
    );
  }

  return (
    <img
      src={cardSprite(card, fourColors)}
      alt={formatCard(card)}
      width={w}
      height={h}
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
      className={`flex items-center justify-center text-center font-label leading-tight text-cream/70 ${s === 1 ? 'break-all' : 'p-1 text-[0.9rem]'}`}
      style={{
        fontSize: s === 1 ? 8 : undefined,
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
