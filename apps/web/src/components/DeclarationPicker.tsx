import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_NAMES, SUIT_SYMBOL, formatDeclaration, rankLabel } from '@tayan/engine';
import type { Category, Declaration, GameSettings, Rank, Suit } from '@tayan/engine';
import { useLang } from '../lib/hooks';
import { availableByCategory, nextStep, paramLabelKey, type Param } from '../lib/declarationTree';

/** Two-step declaration chooser: category first, then its parameters. Only higher hands are offered. */
export function DeclarationPicker({
  declarations,
  settings,
  minOrder,
  onSubmit,
}: {
  declarations: Declaration[];
  settings: GameSettings;
  minOrder: number;
  onSubmit: (declarationId: string) => void;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const [category, setCategory] = useState<Category | null>(null);
  const [chosen, setChosen] = useState<Param[]>([]);
  const byCategory = availableByCategory(declarations, minOrder);

  const reset = () => {
    setCategory(null);
    setChosen([]);
  };

  if (category === null) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-stone-300">{t('table.pickCategory')}</p>
        <div className="grid grid-cols-2 gap-2">
          {settings.categoryOrder.map((c) => {
            const available = byCategory.has(c);
            return (
              <button
                key={c}
                className="btn-ghost justify-start text-left text-sm"
                disabled={!available}
                onClick={() => setCategory(c)}
              >
                {CATEGORY_NAMES[lang][c]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const step = nextStep(byCategory.get(category) ?? [], chosen);
  const crumbs = [CATEGORY_NAMES[lang][category]];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gold">{crumbs.join(' › ')}</span>
        <button
          className="text-sm text-stone-300 underline"
          onClick={() => (chosen.length ? setChosen(chosen.slice(0, -1)) : reset())}
        >
          {t('common.back')}
        </button>
      </div>
      {step.done ? (
        <button className="btn-primary w-full" onClick={() => onSubmit(step.declaration.id)}>
          {t('table.confirm', { name: formatDeclaration(step.declaration, lang) })}
        </button>
      ) : (
        <div>
          <p className="mb-2 text-sm text-stone-300">
            {t(`table.param.${paramLabelKey(category, step.index, step.kind)}`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {step.options.map((value) => (
              <button
                key={value}
                className="btn-ghost min-w-11 px-3"
                onClick={() => setChosen([...chosen, value])}
              >
                {step.kind === 'rank' ? (
                  rankLabel(value as Rank)
                ) : (
                  <span
                    className={value === 'D' || value === 'H' ? 'text-red-400' : 'text-stone-100'}
                    title={t(`table.suits.${value as Suit}`)}
                  >
                    {SUIT_SYMBOL[value as Suit]} {t(`table.suits.${value as Suit}`)}
                  </span>
                )}
              </button>
            ))}
          </div>
          {chosen.length > 0 && (
            <p className="mt-2 text-xs text-stone-400">
              {chosen
                .map((c) => (typeof c === 'number' ? rankLabel(c) : SUIT_SYMBOL[c]))
                .join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
