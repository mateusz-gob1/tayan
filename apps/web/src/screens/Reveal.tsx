import { useTranslation } from 'react-i18next';
import type { PlayerView } from '@tayan/engine';
import { RevealBoard, revealSettledMs } from '../components/RevealBoard';
import { useNow } from '../lib/hooks';
import { useLayoutMode } from '../lib/scale';
import { ready } from '../net/actions';
import type { RoomState } from '../net/types';
import { nickOf } from '../store';

/** The reveal screen: one screen without scrolling, "Next" stays in a fixed bar at the bottom. */
export function Reveal({ view, room }: { view: PlayerView; room: RoomState }) {
  const { t } = useTranslation();
  const now = useNow(250);
  const compact = useLayoutMode() !== 'wide';
  const result = view.lastResult;
  if (!result) return null;

  // Who can skip the reveal: the players still in the game. In the last reveal of the game (one
  // player left) it is everyone who was dealt cards, including the player who just lost, and the
  // end screen follows once they all skipped. A player who has just dropped out otherwise has no
  // button, because the server would refuse the click.
  const isFinal = view.players.filter((p) => !p.eliminated).length <= 1;
  const canSkip = (id: string) =>
    isFinal
      ? result.allHands[id] !== undefined
      : view.players.some((p) => p.id === id && !p.eliminated);
  const waiting = room.members.filter((m) => !m.bot && m.connected && canSkip(m.id));
  const iAmReady = room.readyIds.includes(view.me);
  const secondsLeft = room.revealEndsAt
    ? Math.max(0, Math.ceil((room.revealEndsAt - now) / 1000))
    : null;
  const loser = nickOf(view, room, result.loserId);

  return (
    <div className={`flex h-full min-h-0 flex-col ${compact ? 'gap-2 p-2' : 'gap-3 p-4'}`}>
      <RevealBoard view={view} room={room} result={result} />
      <div
        className="panel flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2"
        style={compact ? { padding: '0.5rem 0.75rem' } : undefined}
      >
        <p
          className="blink text-lg font-bold"
          style={{ animationDelay: `${revealSettledMs(result)}ms` }}
        >
          {t('reveal.gets', { nick: loser })}
          {result.loserEliminated && (
            <span className="ml-2 text-red-300">{t('reveal.eliminated', { nick: loser })}</span>
          )}
        </p>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-300">
            {t('reveal.waitingFor', { ready: room.readyIds.length, total: waiting.length })}
            {secondsLeft !== null && ` · ${t('reveal.autoIn', { sec: secondsLeft })}`}
          </span>
          {canSkip(view.me) && (
            <button
              className="btn-primary px-10 py-2 text-lg"
              disabled={iAmReady}
              onClick={() => void ready()}
            >
              {t('reveal.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
