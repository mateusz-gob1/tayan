import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatDeclaration,
  formatSlot,
  type Card,
  type PlayerView,
  type RoundResult,
} from '@tayan/engine';
import { useDeclarations, useLang } from '../lib/hooks';
import { CARD_H, CARD_W } from '../lib/cards';
import { useArtScale, useLayoutMode, useLayoutScale } from '../lib/scale';
import { FLIP_STEP_MS } from '../lib/sfx';
import type { RoomState } from '../net/types';
import { nickOf } from '../store';
import { EmptySlot, PlayingCard, type Scale } from './PlayingCard';
import { SuitText } from './SuitIcon';

const sameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

const dealtCards = (result: RoundResult) =>
  Object.values(result.allHands).reduce((n, hand) => n + hand.length, 0);

/**
 * The biggest card zoom (up to `max`) at which every player's hand still fits in the panel
 * without scrolling, given the panel's content size; never below 1.
 */
export function fitCardScale(
  hands: number[],
  box: { w: number; h: number },
  max: number,
  rem: number,
): Scale {
  if (box.w === 0 || hands.length === 0) return 1;
  const gapX = 2 * rem;
  const gapY = rem;
  const nameH = 1.6 * rem;
  const titleH = 2.8 * rem;
  const widest = Math.max(...hands);
  for (let s = max; s > 1; s--) {
    const blockW = widest * CARD_W * s + (widest - 1) * 8;
    const cols = Math.max(1, Math.floor((box.w + gapX) / (blockW + gapX)));
    const rows = Math.ceil(hands.length / cols);
    const needed = titleH + rows * (CARD_H * s + nameH) + (rows - 1) * gapY;
    if (needed <= box.h) return s as Scale;
  }
  return 1;
}

/** When the last card has finished turning over, in ms after the reveal starts. */
export function revealSettledMs(result: RoundResult): number {
  return 250 + (result.matchedCards.length + dealtCards(result)) * FLIP_STEP_MS + 200;
}

/**
 * The reveal: the declaration, the hand assembled from the pool (with gaps) on the left and
 * everyone's cards on the right. It fills the space it is given and only scrolls inside a panel
 * when there are very many cards.
 */
export function RevealBoard({
  view,
  room,
  result,
}: {
  view: PlayerView;
  room: RoomState;
  result: RoundResult;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const art = useArtScale();
  const mode = useLayoutMode();
  const { rem } = useLayoutScale();
  const declarations = useDeclarations(view.settings);
  const decl = declarations.find((d) => d.id === result.declarationId);
  const nick = (id: string) => nickOf(view, room, id);
  const total = result.matchedCards.length + result.missingSlots.length;
  // Everyone's hands (right panel) are as big as that panel allows, so the reveal fits on the
  // screen. The declared hand on the left always uses the full zoom; if it depended on the fit
  // too, the two panels would keep resizing each other.
  const poolRef = useRef<HTMLElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = poolRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scale = fitCardScale(
    Object.values(result.allHands).map((h) => h.length),
    box,
    art,
    rem,
  );

  // cards turn over one after another: first the hand from the pool, then everyone's hands
  let flipIndex = 0;
  const nextFlip = () => 250 + flipIndex++ * FLIP_STEP_MS;

  const isMatched = (ownerId: string, card: Card) =>
    result.matchedCards.some((m) => m.ownerId === ownerId && sameCard(m.card, card));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className={
          mode === 'short'
            ? 'flex flex-wrap items-baseline justify-center gap-x-4 text-center'
            : 'text-center'
        }
      >
        <p className="text-xs uppercase tracking-widest text-stone-300">{t('reveal.title')}</p>
        <p
          className={`${mode === 'short' ? 'text-2xl' : 'text-3xl'} font-bold leading-tight text-gold`}
        >
          {decl ? (
            <SuitText text={formatDeclaration(decl, lang)} size={21} />
          ) : (
            result.declarationId
          )}
        </p>
        <p className="text-sm text-stone-300">
          {t('reveal.declared', { nick: nick(result.declarerId) })} ·{' '}
          {t('reveal.checkedBy', { nick: nick(result.checkerId) })}
        </p>
      </div>

      <div
        className={`grid min-h-0 flex-1 gap-3 ${
          mode === 'short'
            ? 'grid-cols-[auto_minmax(0,1fr)]'
            : mode === 'portrait'
              ? 'grid-rows-[auto_minmax(0,1fr)]'
              : 'lg:grid-cols-[auto_minmax(0,1fr)]'
        }`}
      >
        <section
          className="panel flex min-h-0 min-w-64 flex-col gap-3 overflow-y-auto"
          style={mode === 'wide' ? undefined : { padding: '0.5rem' }}
        >
          <h3 className="text-sm font-semibold text-stone-300">{t('reveal.hand')}</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {result.matchedCards.map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <PlayingCard card={m.card} scale={art} highlight flipDelay={nextFlip()} />
                <span className="text-[0.95rem] text-stone-300">
                  {t('reveal.owner', { nick: nick(m.ownerId) })}
                </span>
              </div>
            ))}
            {result.missingSlots.map((slot, i) => (
              <EmptySlot
                key={`m${i}`}
                scale={art}
                label={t('reveal.emptySlot', { what: formatSlot(slot, lang) })}
              />
            ))}
          </div>
          <p
            className={`text-center text-sm font-semibold ${result.existed ? 'text-emerald-300' : 'text-red-300'}`}
          >
            {result.existed
              ? t('reveal.exists')
              : t('reveal.missing', { missing: result.missingSlots.length, total })}
          </p>
        </section>

        <section
          ref={poolRef}
          className="panel min-h-0 overflow-y-auto"
          style={mode === 'wide' ? undefined : { padding: '0.5rem' }}
        >
          <h3
            className={`${mode === 'wide' ? 'mb-3' : 'mb-1'} text-sm font-semibold text-stone-300`}
          >
            {t('reveal.pool')}
          </h3>
          <div
            className={`flex flex-wrap ${mode === 'wide' ? 'gap-x-8 gap-y-4' : 'gap-x-3 gap-y-2'}`}
          >
            {Object.entries(result.allHands).map(([ownerId, cards]) => (
              <div key={ownerId} className="flex flex-col gap-1">
                <span
                  className={`text-sm font-semibold ${ownerId === result.loserId ? 'text-red-300' : ''}`}
                >
                  {nick(ownerId)}
                </span>
                <div className="flex gap-2">
                  {cards.map((c) => {
                    const matched = isMatched(ownerId, c);
                    return (
                      <PlayingCard
                        key={`${c.rank}${c.suit}`}
                        card={c}
                        scale={scale}
                        highlight={matched}
                        dim={!matched}
                        flipDelay={nextFlip()}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
