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

/** Keeps the screen awake while `active`: a phone would dim and lock during a long wait for a turn. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {
          /* not allowed right now (for example a low battery): the game works without it */
        });
    };
    request();
    // the lock is dropped when the tab is hidden, so ask again when it comes back
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
