import { useTranslation } from 'react-i18next';
import type { PlayerView } from '@tayan/engine';
import { TrophyMark } from '../components/Logo';
import { RevealBoard } from '../components/RevealBoard';
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
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="text-center">
        <div className="bounce flex justify-center">
          <TrophyMark size={11 * iconZoom(rem) * 2} />
        </div>
        <h2 className="mt-2 text-4xl font-black text-gold">
          {winner ? t('gameOver.winner', { nick: nick(winner) }) : ''}
        </h2>
        {winner === view.me && <p className="mt-1 text-lg">{t('gameOver.youWon')}</p>}
      </div>

      <div className="panel mx-auto max-w-sm">
        <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('gameOver.order')}</h3>
        <ol className="space-y-1">
          {ranking.map((id, i) => (
            <li key={id} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5">
              <span className="text-stone-300">{t('gameOver.place', { n: i + 1 })}</span>
              <span className="font-semibold">{nick(id)}</span>
            </li>
          ))}
        </ol>
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

      {view.lastResult && <RevealBoard view={view} room={room} result={view.lastResult} />}
    </div>
  );
}
