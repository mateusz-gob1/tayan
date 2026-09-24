import { useTranslation } from 'react-i18next';
import type { PlayerView } from '@tayan/engine';
import { RevealBoard, revealSettledMs } from '../components/RevealBoard';
import { useNow } from '../lib/hooks';
import { ready } from '../net/actions';
import type { RoomState } from '../net/types';
import { nickOf } from '../store';

/** The reveal screen: one screen without scrolling, "Next" stays in a fixed bar at the bottom. */
export function Reveal({ view, room }: { view: PlayerView; room: RoomState }) {
  const { t } = useTranslation();
  const now = useNow(250);
  const result = view.lastResult;
  if (!result) return null;

  // Everyone who was dealt cards this round can skip, including the player who just lost. In the
  // last reveal of the game (one player left) the end screen follows once they all skipped.
  const inRound = result.allHands[view.me] !== undefined;
  const isFinal = view.players.filter((p) => !p.eliminated).length <= 1;
  const waiting = room.members.filter(
    (m) =>
      !m.bot &&
      m.connected &&
      (isFinal
        ? result.allHands[m.id] !== undefined
        : view.players.some((p) => p.id === m.id && !p.eliminated)),
  );
  const iAmReady = room.readyIds.includes(view.me);
  const secondsLeft = room.revealEndsAt
    ? Math.max(0, Math.ceil((room.revealEndsAt - now) / 1000))
    : null;
  const loser = nickOf(view, room, result.loserId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <RevealBoard view={view} room={room} result={result} />
      <div className="panel flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
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
          {inRound && (
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
