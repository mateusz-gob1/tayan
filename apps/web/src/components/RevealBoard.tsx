import { useTranslation } from 'react-i18next';
import {
  formatDeclaration,
  formatSlot,
  type Card,
  type PlayerView,
  type RoundResult,
} from '@tayan/engine';
import { useDeclarations, useLang } from '../lib/hooks';
import type { RoomState } from '../net/types';
import { nickOf } from '../store';
import { EmptySlot, PlayingCard } from './PlayingCard';
import { SuitText } from './SuitIcon';

const sameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

/** Everyone's cards, the declared hand assembled from the pool (with gaps), and who gets a card. */
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
  const declarations = useDeclarations(view.settings);
  const decl = declarations.find((d) => d.id === result.declarationId);
  const nick = (id: string) => nickOf(view, room, id);
  const total = result.matchedCards.length + result.missingSlots.length;

  const isMatched = (ownerId: string, card: Card) =>
    result.matchedCards.some((m) => m.ownerId === ownerId && sameCard(m.card, card));

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-stone-300">
          {t('reveal.declared', { nick: nick(result.declarerId) })}
        </p>
        <p className="text-3xl font-black text-gold">
          {decl ? (
            <SuitText text={formatDeclaration(decl, lang)} size={28} />
          ) : (
            result.declarationId
          )}
        </p>
        <p className="text-sm text-stone-300">
          {t('reveal.checkedBy', { nick: nick(result.checkerId) })}
        </p>
      </div>

      <div className="panel">
        <h3 className="mb-3 text-sm font-semibold text-stone-300">{t('reveal.hand')}</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {result.matchedCards.map((m, i) => (
            <div
              key={i}
              className="pop-in flex flex-col items-center gap-1"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <PlayingCard card={m.card} scale={2} highlight />
              <span className="text-[0.7rem] text-stone-300">
                {t('reveal.owner', { nick: nick(m.ownerId) })}
              </span>
            </div>
          ))}
          {result.missingSlots.map((slot, i) => (
            <div key={`m${i}`} className="flex flex-col items-center gap-1">
              <EmptySlot
                scale={2}
                label={t('reveal.emptySlot', { what: formatSlot(slot, lang) })}
              />
            </div>
          ))}
        </div>
        <p
          className={`mt-3 text-center text-sm font-semibold ${result.existed ? 'text-emerald-300' : 'text-red-300'}`}
        >
          {result.existed
            ? t('reveal.exists')
            : t('reveal.missing', { missing: result.missingSlots.length, total })}
        </p>
      </div>

      <div className="panel">
        <h3 className="mb-3 text-sm font-semibold text-stone-300">{t('reveal.pool')}</h3>
        <div className="space-y-3">
          {Object.entries(result.allHands).map(([ownerId, cards]) => (
            <div key={ownerId} className="flex items-center gap-3">
              <span
                className={`w-28 shrink-0 truncate text-sm font-semibold ${ownerId === result.loserId ? 'text-red-300' : ''}`}
              >
                {nick(ownerId)}
              </span>
              <div className="flex flex-wrap gap-2">
                {cards.map((c) => {
                  const matched = isMatched(ownerId, c);
                  return (
                    <PlayingCard
                      key={`${c.rank}${c.suit}`}
                      card={c}
                      scale={2}
                      highlight={matched}
                      dim={!matched}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-lg font-bold">
        {t('reveal.gets', { nick: nick(result.loserId) })}
        {result.loserEliminated && (
          <span className="ml-2 text-red-300">
            {t('reveal.eliminated', { nick: nick(result.loserId) })}
          </span>
        )}
      </p>
    </div>
  );
}
