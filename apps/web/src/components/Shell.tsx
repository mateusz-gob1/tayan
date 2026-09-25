import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { leaveRoom } from '../net/socket';
import { isMuted, setMuted } from '../lib/sound';
import { useLayoutMode } from '../lib/scale';
import { useStore } from '../store';
import { HelpPanel } from './HelpPanel';
import { LogoImage } from './Logo';
import { SuitIcon } from './SuitIcon';

/** Header, global notice banner and the collapsible help column shared by all screens. */
export function Shell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const helpOpen = useStore((s) => s.helpOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const notice = useStore((s) => s.notice);
  const setNotice = useStore((s) => s.setNotice);
  const conn = useStore((s) => s.conn);
  const fourColors = useStore((s) => s.fourColors);
  const setFourColors = useStore((s) => s.setFourColors);
  const inRoom = useStore((s) => s.session !== null);
  const [muted, setMutedState] = useState(isMuted());
  const mode = useLayoutMode();
  const compact = mode !== 'wide';

  // H toggles help, unless the user is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key.toLowerCase() === 'h') setHelpOpen(!useStore.getState().helpOpen);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setHelpOpen]);

  // Notices disappear on their own.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice, setNotice]);

  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  return (
    <div className="flex h-full flex-col">
      <header
        className={`flex items-center gap-3 border-b border-white/10 bg-black/30 ${compact ? 'px-3 py-1' : 'px-5 py-1'}`}
      >
        {inRoom && !compact && <LogoImage />}
        <div className="ml-auto flex items-center gap-2">
          {conn === 'reconnecting' && (
            <span className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
              {t('conn.reconnecting')}
            </span>
          )}
          <button
            className="btn-ghost px-2.5 py-1 text-sm"
            onClick={() => void i18n.changeLanguage(lang === 'pl' ? 'en' : 'pl')}
            aria-label="Language"
          >
            {lang === 'pl' ? 'PL' : 'EN'}
          </button>
          <button
            className={`btn-ghost px-2.5 py-1 text-sm ${fourColors ? 'brightness-125' : ''}`}
            title={t('nav.fourColors')}
            aria-label={t('nav.fourColors')}
            aria-pressed={fourColors}
            onClick={() => setFourColors(!fourColors)}
          >
            <SuitIcon suit="D" size={14} />
            <SuitIcon suit="C" size={14} />
          </button>
          <button
            className="btn-ghost px-2.5 py-1 text-sm"
            title={muted ? t('nav.soundOff') : t('nav.soundOn')}
            aria-label={muted ? t('nav.soundOff') : t('nav.soundOn')}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            className={`btn-ghost px-3 py-1 text-sm ${helpOpen ? 'bg-white/20' : ''}`}
            title={t('nav.help')}
            aria-label={t('nav.help')}
            aria-pressed={helpOpen}
            onClick={() => setHelpOpen(!helpOpen)}
          >
            ?
          </button>
          {inRoom && (
            <button className="btn-ghost px-3 py-1 text-sm" onClick={() => void leaveRoom()}>
              {compact ? t('nav.leaveShort') : t('nav.leave')}
            </button>
          )}
        </div>
      </header>
      {notice && (
        <div
          className="flex items-center justify-between bg-red-700/90 px-5 py-2 text-sm font-medium"
          role="alert"
        >
          <span>{t(`errors.${notice}`, { defaultValue: t('errors.INTERNAL') })}</span>
          <button onClick={() => setNotice(null)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        {helpOpen && <HelpPanel />}
      </div>
    </div>
  );
}
