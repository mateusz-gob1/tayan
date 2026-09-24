import type { Card } from '@tayan/engine';
import { SUIT_SYMBOL, rankLabel } from '@tayan/engine';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  sm: 'h-[3.4rem] w-10 text-sm rounded-md',
  md: 'h-[5rem] w-14 text-base rounded-lg',
  lg: 'h-[6.5rem] w-[4.5rem] text-lg rounded-xl',
};

export function PlayingCard({
  card,
  size = 'md',
  highlight = false,
  dim = false,
}: {
  card: Card;
  size?: Size;
  highlight?: boolean;
  dim?: boolean;
}) {
  const red = card.suit === 'D' || card.suit === 'H';
  return (
    <div
      className={`relative select-none border border-stone-300 bg-white font-bold shadow-md transition ${SIZES[size]} ${
        red ? 'text-card-red' : 'text-slate-900'
      } ${highlight ? '-translate-y-1 ring-2 ring-gold' : ''} ${dim ? 'opacity-40' : ''}`}
      aria-label={`${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`}
    >
      <span className="absolute left-1 top-0.5 leading-tight">
        {rankLabel(card.rank)}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-[1.7em] opacity-90">
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}

export function CardBack({ size = 'sm' }: { size?: Size }) {
  return (
    <div
      className={`border border-white/40 shadow ${SIZES[size]}`}
      style={{
        background: 'repeating-linear-gradient(45deg, #1d3f8f 0 4px, #274fae 4px 8px)',
      }}
    />
  );
}

export function EmptySlot({ label, size = 'md' }: { label: string; size?: Size }) {
  return (
    <div
      className={`flex items-center justify-center border-2 border-dashed border-white/40 p-1 text-center text-[0.65rem] leading-tight text-stone-300 ${SIZES[size]}`}
    >
      {label}
    </div>
  );
}
