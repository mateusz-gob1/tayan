import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeclarations, type Declaration, type GameSettings } from '@tayan/engine';
import type { Lang } from '../i18n';

/** Current time, refreshed every `ms`; used for countdowns. */
export function useNow(ms = 500): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('pl') ? 'pl' : 'en';
}

/** All declarations for a game's settings (same list the server uses). */
export function useDeclarations(
  settings: Pick<GameSettings, 'lowestRank' | 'categoryOrder'>,
): Declaration[] {
  return useMemo(
    () =>
      getDeclarations({ lowestRank: settings.lowestRank, categoryOrder: settings.categoryOrder }),
    [settings.lowestRank, settings.categoryOrder],
  );
}
