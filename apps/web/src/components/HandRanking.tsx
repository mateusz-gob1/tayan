import { useTranslation } from 'react-i18next';
import { CATEGORY_NAMES, type Category } from '@tayan/engine';
import { useLang } from '../lib/hooks';

/**
 * A compact, always-visible list of this game's hand ranking (weakest to strongest), for the
 * table's side column. `HelpPanel` shows the same `categoryOrder` with descriptions and examples;
 * this is the short version so a player does not have to open help mid-game to check it.
 */
export function HandRanking({ categoryOrder }: { categoryOrder: readonly Category[] }) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('table.ranking')}</h3>
      <ol className="space-y-0.5 text-sm">
        {categoryOrder.map((c, i) => (
          <li key={c} className="flex gap-2">
            <span className="w-4 shrink-0 text-right text-stone-500">{i + 1}.</span>
            <span>{CATEGORY_NAMES[lang][c]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
