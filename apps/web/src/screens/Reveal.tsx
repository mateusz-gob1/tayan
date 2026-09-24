import { useTranslation } from 'react-i18next';
import type { PlayerView } from '@tayan/engine';
import { RevealBoard } from '../components/RevealBoard';
import { useNow } from '../lib/hooks';
import { ready } from '../net/actions';
import type { RoomState } from '../net/types';

export function Reveal({ view, room }: { view: PlayerView; room: RoomState }) {
  const { t } = useTranslation();
  const now = useNow(250);
  const result = view.lastResult;
  if (!result) return null;

  const me = view.players.find((p) => p.id === view.me);
  const canClick = me !== undefined && !me.eliminated;
  const waiting = view.players.filter((p) => !p.eliminated && p.connected);
  const iAmReady = room.readyIds.includes(view.me);
  const secondsLeft = room.revealEndsAt
    ? Math.max(0, Math.ceil((room.revealEndsAt - now) / 1000))
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <h2 className="text-center text-sm uppercase tracking-widest text-stone-300">
        {t('reveal.title')}
      </h2>
      <RevealBoard view={view} room={room} result={result} />
      <div className="flex flex-col items-center gap-2">
        {canClick && (
          <button
            className="btn-primary px-10 py-3 text-lg"
            disabled={iAmReady}
            onClick={() => void ready()}
          >
            {t('reveal.next')}
          </button>
        )}
        <p className="text-sm text-stone-300">
          {t('reveal.waitingFor', { ready: room.readyIds.length, total: waiting.length })}
          {secondsLeft !== null && ` · ${t('reveal.autoIn', { sec: secondsLeft })}`}
        </p>
      </div>
    </div>
  );
}
