import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CATEGORY_NAMES,
  DEFAULT_CATEGORY_ORDER,
  deckSize,
  formatDeclaration,
  rankLabel,
  type GameSettings,
} from '@tayan/engine';
import { useDeclarations, useLang } from '../lib/hooks';
import { useStore } from '../store';

const DEFAULT_SETTINGS: GameSettings = {
  deckMode: 'AUTO',
  lowestRank: 9,
  startingCards: 2,
  eliminationLimit: 5,
  categoryOrder: [...DEFAULT_CATEGORY_ORDER],
  turnTimerSec: null,
  inactiveTimeoutSec: null,
  kickVoteAfterSec: 120,
};

type Tab = 'categories' | 'settings' | 'rules';

/** Side panel available on every screen; content is generated from the current game's settings. */
export function HelpPanel() {
  const { t } = useTranslation();
  const lang = useLang();
  const [tab, setTab] = useState<Tab>('categories');
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const settings = view?.settings ?? room?.settings ?? DEFAULT_SETTINGS;
  const declarations = useDeclarations(settings);
  const inRoom = Boolean(room);
  const players = view ? view.players.length : room?.members.filter((m) => !m.spectator).length;

  return (
    <aside
      className="flex w-[22rem] shrink-0 flex-col border-l border-white/10 bg-black/35 backdrop-blur"
      aria-label={t('help.title')}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-lg font-bold text-gold">{t('help.title')}</h2>
        <button
          className="btn-ghost px-2 py-1"
          onClick={() => setHelpOpen(false)}
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex gap-1 px-3">
        {(['categories', 'settings', 'rules'] as Tab[]).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-t-lg px-2 py-1.5 text-xs font-semibold ${
              tab === id ? 'bg-white/15 text-gold' : 'text-stone-300 hover:bg-white/5'
            }`}
          >
            {t(`help.tabs.${id}`)}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto bg-white/5 p-4 text-sm">
        {tab === 'categories' && (
          <div>
            {!inRoom && <p className="mb-3 text-xs text-stone-400">{t('help.noRoom')}</p>}
            <p className="mb-3 text-stone-300">{t('help.order')}</p>
            <ol className="space-y-3">
              {settings.categoryOrder.map((c, i) => {
                const list = declarations.filter((d) => d.category === c);
                const example = list[Math.floor(list.length / 2)];
                return (
                  <li key={c} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">
                        {i + 1}. {CATEGORY_NAMES[lang][c]}
                      </span>
                      <span className="text-xs text-stone-400">
                        {t('help.howMany', { count: list.length })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-300">{t(`help.params.${c}`)}</p>
                    {example && (
                      <p className="mt-1 text-xs text-gold">
                        {t('help.example', { name: formatDeclaration(example, lang) })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-stone-400">{t('help.colorOrder')}</p>
          </div>
        )}
        {tab === 'settings' && (
          <div>
            {!inRoom && <p className="mb-3 text-xs text-stone-400">{t('help.noRoom')}</p>}
            <dl className="space-y-2">
              <Row label={t('help.settings.deck')}>
                {t('settings.deckSummary', {
                  rank: rankLabel(settings.lowestRank),
                  cards: deckSize(settings.lowestRank),
                })}
              </Row>
              <Row label={t('help.settings.startingCards')}>{settings.startingCards}</Row>
              <Row label={t('help.settings.eliminationLimit')}>{settings.eliminationLimit}</Row>
              <Row label={t('help.settings.turnTimer')}>
                {settings.turnTimerSec
                  ? t('settings.seconds', { count: settings.turnTimerSec })
                  : t('settings.off')}
              </Row>
              {players !== undefined && <Row label={t('help.settings.players')}>{players}</Row>}
            </dl>
          </div>
        )}
        {tab === 'rules' && (
          <div>
            <ol className="list-decimal space-y-3 pl-5">
              {['1', '2', '3', '4', '5', '6'].map((n) => (
                <li key={n}>{t(`help.rules.${n}`)}</li>
              ))}
            </ol>
            <a
              className="mt-4 block text-xs text-gold underline"
              href="https://github.com/mateusz-gob1/tayan"
              target="_blank"
              rel="noreferrer"
            >
              {t('help.fullRules')}
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
      <dt className="text-stone-300">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
