import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackdropSuits, SuitStrip } from '../components/Ornaments';
import { MAX_PLAYERS, deckSize, rankLabel, type GameSettings, type Rank } from '@tayan/engine';
import { addBot, kick, playWithBots, setSettings, startGame } from '../net/actions';

// Testing aid, easy to hide: set VITE_ENABLE_BOTS=false when building the client.
const BOTS_ENABLED = import.meta.env.VITE_ENABLE_BOTS !== 'false';
import type { RoomState } from '../net/types';
import { useStore } from '../store';

export function Lobby({ room }: { room: RoomState }) {
  const { t } = useTranslation();
  const me = useStore((s) => s.session?.playerId);
  const isHost = room.hostId === me;
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const players = room.members.filter((m) => !m.spectator);
  const link = `${window.location.origin}/r/${room.code}`;

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? room.code : link);
    } catch {
      /* clipboard may be blocked; the code and the link are visible anyway */
    }
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="relative mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-2">
      <BackdropSuits />
      <section className="panel-deco space-y-4">
        <SuitStrip />
        <div>
          <p className="text-sm text-stone-300">{t('lobby.roomCode')}</p>
          <p data-testid="room-code" className="text-5xl font-black tracking-[0.3em] text-gold">
            {room.code}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => void copy('code')}>
              {copied === 'code' ? t('lobby.codeCopied') : t('lobby.copyCode')}
            </button>
            <button className="btn-ghost" onClick={() => void copy('link')}>
              {copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyLink')}
            </button>
          </div>
          <p className="mt-2 break-all text-xs text-stone-400">{link}</p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-bold">
            {t('lobby.players', { count: room.members.length })}
          </h2>
          <ul className="space-y-1.5">
            {room.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${m.connected ? 'bg-emerald-400' : 'bg-stone-500'}`}
                />
                <span className="font-medium">{m.nick}</span>
                {m.id === me && <span className="text-xs text-stone-400">({t('lobby.you')})</span>}
                {m.id === room.hostId && (
                  <span className="rounded bg-gold/20 px-1.5 text-xs font-semibold text-gold">
                    {t('lobby.host')}
                  </span>
                )}
                {m.bot && <span className="text-xs text-stone-400">{t('lobby.bot')}</span>}
                {m.spectator && (
                  <span className="text-xs text-stone-400">{t('lobby.spectator')}</span>
                )}
                {!m.connected && (
                  <span className="text-xs text-stone-400">{t('lobby.offline')}</span>
                )}
                {isHost && m.id !== me && (
                  <button
                    className="ml-auto text-xs text-red-300 underline"
                    onClick={() => void kick(m.id)}
                  >
                    {t('lobby.kick')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div>
            <button
              className="btn-primary w-full py-3 text-lg"
              disabled={players.filter((p) => p.connected).length < 2}
              onClick={() => void startGame()}
            >
              {t('lobby.start')}
            </button>
            {players.filter((p) => p.connected).length < 2 && (
              <p className="mt-2 text-center text-sm text-stone-400">{t('lobby.needTwo')}</p>
            )}
            {BOTS_ENABLED && (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                <div className="flex gap-2">
                  <button
                    className="btn-ghost flex-1 text-sm"
                    disabled={room.members.length >= MAX_PLAYERS}
                    onClick={() => void addBot()}
                  >
                    {t('lobby.addBot')}
                  </button>
                  <button
                    className="btn-ghost flex-1 text-sm"
                    disabled={room.members.length > MAX_PLAYERS}
                    onClick={() => void playWithBots()}
                  >
                    {t('lobby.playWithBots')}
                  </button>
                </div>
                <p className="text-center text-xs text-stone-400">{t('lobby.botsHint')}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-stone-300">{t('lobby.waitHost')}</p>
        )}
      </section>

      <section className="panel-deco space-y-3">
        <SuitStrip />
        <h2 className="text-lg font-bold">{t('lobby.settings')}</h2>
        {room.deckWarning && (
          <p className="rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-100">
            {t('lobby.deckWarning')}
          </p>
        )}
        <SettingsForm room={room} editable={isHost} playerCount={Math.max(2, players.length)} />
        {!isHost && <p className="text-xs text-stone-400">{t('lobby.onlyHost')}</p>}
        <p className="text-xs text-stone-500">max {MAX_PLAYERS}</p>
      </section>
    </div>
  );
}

function SettingsForm({
  room,
  editable,
  playerCount,
}: {
  room: RoomState;
  editable: boolean;
  playerCount: number;
}) {
  const { t } = useTranslation();
  const s = room.settings;
  const o = room.overrides;
  const send = (partial: Partial<GameSettings>) => void setSettings(partial);
  const auto = (key: keyof GameSettings) => (o[key] === undefined ? ` (${t('lobby.auto')})` : '');

  const seconds = (n: number | null) =>
    n === null ? t('settings.off') : t('settings.seconds', { count: n });
  const minutes = (n: number | null) =>
    n === null ? t('settings.forever') : t('settings.minutes', { count: n / 60 });

  return (
    <div className="space-y-3">
      <Field
        label={`${t('settings.deckMode')}${s.deckMode === 'AUTO' ? ` (${t('lobby.auto')})` : ''}`}
      >
        <Select
          disabled={!editable}
          value={s.deckMode}
          onChange={(v) => send({ deckMode: v as GameSettings['deckMode'] })}
          options={(['AUTO', 'FULL', 'CUSTOM'] as const).map((m) => [
            m,
            t(`settings.deckModes.${m}`),
          ])}
        />
        <p className="mt-1 text-xs text-stone-300">
          {t('settings.deckSummary', {
            rank: rankLabel(s.lowestRank),
            cards: deckSize(s.lowestRank),
          })}
        </p>
      </Field>

      {s.deckMode === 'CUSTOM' && (
        <Field label={t('settings.lowestRank')}>
          <Select
            disabled={!editable}
            value={String(s.lowestRank)}
            onChange={(v) => send({ lowestRank: Number(v) as Rank })}
            options={[9, 8, 7, 6, 5, 4, 3, 2].map((r) => {
              const tooSmall = (s.eliminationLimit - 1) * playerCount > deckSize(r as Rank);
              return [
                String(r),
                `${rankLabel(r as Rank)} (${deckSize(r as Rank)})${tooSmall ? ` - ${t('settings.tooSmall')}` : ''}`,
                tooSmall,
              ] as const;
            })}
          />
        </Field>
      )}

      <Field label={`${t('settings.startingCards')}${auto('startingCards')}`}>
        <Select
          disabled={!editable}
          value={String(s.startingCards)}
          onChange={(v) => send({ startingCards: Number(v) as 1 | 2 })}
          options={[
            ['1', '1'],
            ['2', '2'],
          ]}
        />
      </Field>

      <Field label={t('settings.eliminationLimit')}>
        <Select
          disabled={!editable}
          value={String(s.eliminationLimit)}
          onChange={(v) => send({ eliminationLimit: Number(v) })}
          options={[3, 4, 5, 6].map((n) => {
            // five-card hands must fit in even the full 52-card deck
            const tooMany = (n - 1) * playerCount > deckSize(2);
            return [String(n), String(n), tooMany] as const;
          })}
        />
      </Field>

      <Field label={t('settings.turnTimer')}>
        <Select
          disabled={!editable}
          value={String(s.turnTimerSec)}
          onChange={(v) => send({ turnTimerSec: v === 'null' ? null : Number(v) })}
          options={[null, 15, 30, 60, 120].map((n) => [String(n), seconds(n)] as const)}
        />
      </Field>

      <Field label={t('settings.inactiveTimeout')}>
        <Select
          disabled={!editable}
          value={String(s.inactiveTimeoutSec)}
          onChange={(v) => send({ inactiveTimeoutSec: v === 'null' ? null : Number(v) })}
          options={[null, 120, 300, 600].map((n) => [String(n), minutes(n)] as const)}
        />
      </Field>

      <Field label={t('settings.kickVoteAfter')}>
        <Select
          disabled={!editable}
          value={String(s.kickVoteAfterSec)}
          onChange={(v) => send({ kickVoteAfterSec: Number(v) })}
          options={[60, 120, 300].map((n) => [String(n), seconds(n)] as const)}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-stone-300">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: readonly (readonly [string, string] | readonly [string, string, boolean])[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="input"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, label, off]) => (
        <option key={v} value={v} disabled={off} className="text-black">
          {label}
        </option>
      ))}
    </select>
  );
}
