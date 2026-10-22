import { useTranslation } from 'react-i18next';
import type { PlayerView } from '@tayan/engine';
import { TrophyMark } from '../components/Logo';
import { BackdropSuits, SuitStrip } from '../components/Ornaments';
import { iconZoom, useLayoutScale } from '../lib/scale';
import { rematch } from '../net/actions';
import { leaveRoom } from '../net/socket';
import type { RoomState } from '../net/types';
import { nickOf, useStore } from '../store';

export function GameOver({ view, room }: { view: PlayerView; room: RoomState }) {
  const { t } = useTranslation();
  const { rem } = useLayoutScale();
  const me = useStore((s) => s.session?.playerId);
  const isHost = room.hostId === me;
  const winner = view.winner;
  const nick = (id: string) => nickOf(view, room, id);
  // 1st place is the winner, then the players who dropped out last.
  const ranking = winner ? [winner, ...[...view.eliminatedOrder].reverse()] : [];

  return (
    <div className="relative mx-auto max-w-4xl space-y-6 p-6">
      <BackdropSuits />
      <div className="text-center">
        <div className="bounce flex justify-center">
          <TrophyMark size={11 * iconZoom(rem) * 2} />
        </div>
        <h2 className="mt-2 text-4xl font-black text-gold">
          {winner ? t('gameOver.winner', { nick: nick(winner) }) : ''}
        </h2>
        {winner === view.me && <p className="mt-1 text-lg">{t('gameOver.youWon')}</p>}
      </div>

      <div className="mx-auto grid max-w-3xl items-start gap-4 md:grid-cols-2">
        <div className="panel-deco w-full space-y-2">
          <SuitStrip />
          <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('gameOver.order')}</h3>
          <ol className="space-y-1">
            {ranking.map((id, i) => (
              <li key={id} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5">
                <span className="text-stone-300">{t('gameOver.place', { n: i + 1 })}</span>
                <span className="font-semibold">{nick(id)}</span>
              </li>
            ))}
          </ol>
          <SuitStrip />
        </div>

        {room.scores.length > 0 && (
          <div className="panel-deco w-full space-y-2" data-testid="scoreboard">
            <SuitStrip />
            <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('gameOver.scores')}</h3>
            <ol className="space-y-1">
              {room.scores.map((row) => (
                <li
                  key={row.id}
                  className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-1.5"
                >
                  <span className="font-semibold">{row.nick}</span>
                  <span>
                    {row.gained > 0 && (
                      <span className="mr-2 text-sm text-gold">+{row.gained}</span>
                    )}
                    <span className="text-stone-300">
                      {t('gameOver.points', { count: row.points })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-stone-400">{t('gameOver.scoresHint')}</p>
            <SuitStrip />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        {isHost ? (
          <button className="btn-primary px-10 py-3 text-lg" onClick={() => void rematch()}>
            {t('gameOver.rematch')}
          </button>
        ) : (
          <p className="text-stone-300">{t('gameOver.waitRematch')}</p>
        )}
        <button className="text-sm text-stone-300 underline" onClick={() => void leaveRoom()}>
          {t('gameOver.leave')}
        </button>
      </div>
    </div>
  );
}
