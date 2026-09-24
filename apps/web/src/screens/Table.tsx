import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDeclaration, type Declaration, type PlayerView } from '@tayan/engine';
import { CardBack, PlayingCard } from '../components/PlayingCard';
import { DeclarationPicker } from '../components/DeclarationPicker';
import { SuitText } from '../components/SuitIcon';
import { useDeclarations, useLang, useNow } from '../lib/hooks';
import { playTurnSound, startTitleBlink, stopTitleBlink } from '../lib/sound';
import { check, declare, voteKick } from '../net/actions';
import type { RoomState, ServerEvent } from '../net/types';
import { nickOf, useStore } from '../store';

export function Table({ view, room }: { view: PlayerView; room: RoomState }) {
  const { t } = useTranslation();
  const lang = useLang();
  const log = useStore((s) => s.log);
  const declarations = useDeclarations(view.settings);
  const byId = (id: string) => declarations.find((d) => d.id === id);
  const now = useNow(250);

  const myPlayer = view.players.find((p) => p.id === view.me);
  const isPlayer = myPlayer !== undefined && !myPlayer.eliminated;
  const myTurn = isPlayer && view.currentTurn === view.me;
  const lastBid = view.bids[view.bids.length - 1];
  const lastDecl = lastBid ? byId(lastBid.declarationId) : undefined;
  const secondsLeft = view.turnDeadline
    ? Math.max(0, Math.ceil((view.turnDeadline - now) / 1000))
    : null;

  // Sound and a flashing title when the turn passes to me.
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      playTurnSound();
      startTitleBlink(`▶ ${t('table.yourTurn')}`);
    }
    if (!myTurn) stopTitleBlink();
    wasMyTurn.current = myTurn;
  }, [myTurn, t]);

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-4">
        <div className="table-shape mx-auto max-w-4xl bg-wood p-3">
          <div className="table-shape felt-texture relative h-[34rem]">
            <div className="absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-xs uppercase tracking-widest text-stone-300">
                {t('table.round', { n: view.roundNumber })}
              </p>
              {lastDecl && lastBid ? (
                <div key={lastBid.declarationId} className="pop-in mt-1">
                  <p className="text-xs text-stone-300">
                    {t('table.lastBidBy', { nick: nickOf(view, room, lastBid.playerId) })}
                  </p>
                  <p className="text-2xl font-bold leading-tight text-gold">
                    <SuitText text={formatDeclaration(lastDecl, lang)} size={21} />
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-stone-200">{t('table.noBids')}</p>
              )}
            </div>
            {view.players.map((p, i) => {
              const myIndex = Math.max(
                0,
                view.players.findIndex((x) => x.id === view.me),
              );
              const rel = (i - myIndex + view.players.length) % view.players.length;
              const theta = ((90 + (rel * 360) / view.players.length) * Math.PI) / 180;
              const x = 50 + 44 * Math.cos(theta);
              const y = 50 + 42 * Math.sin(theta);
              const active = view.currentTurn === p.id && !p.eliminated;
              return (
                <div
                  key={p.id}
                  className={`absolute flex h-[156px] w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border-4 px-2 text-center shadow-md ${
                    active ? 'border-gold bg-wood-light' : 'border-ink bg-panel'
                  } ${p.eliminated ? 'opacity-40 grayscale' : ''}`}
                  // snap to whole pixels (even numbers, since the box is centred), or the sprites blur
                  style={{ left: `round(nearest, ${x}%, 2px)`, top: `round(nearest, ${y}%, 2px)` }}
                >
                  <p className="max-w-[7rem] truncate text-sm font-bold">
                    {p.nick}
                    {p.id === view.me && ' ★'}
                  </p>
                  <div className="mt-1 flex justify-center">
                    {Array.from({ length: Math.min(p.cardCount, 5) }).map((_, k) => (
                      <div key={k} style={{ marginLeft: k === 0 ? 0 : -36 }}>
                        <CardBack scale={1} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-0.5 text-[0.7rem] text-stone-300">
                    {p.eliminated
                      ? t('table.eliminated')
                      : !p.connected
                        ? t('table.offline')
                        : t('table.cards', { count: p.cardCount })}
                  </p>
                  {active && secondsLeft !== null && (
                    <p className="text-xs font-bold text-gold">
                      {t('table.timeLeft', { sec: secondsLeft })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('table.myCards')}</h3>
          {view.myCards.length ? (
            <div className="flex flex-wrap gap-3">
              {view.myCards.map((c) => (
                <PlayingCard key={`${c.rank}${c.suit}`} card={c} scale={2} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">{isPlayer ? '' : t('table.spectating')}</p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <ActionPanel
          view={view}
          room={room}
          declarations={declarations}
          myTurn={myTurn}
          isPlayer={isPlayer}
          now={now}
        />
        <div className="panel max-h-80 overflow-y-auto">
          <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('table.bidHistory')}</h3>
          <ol className="space-y-1 text-sm">
            {view.bids.map((b, i) => {
              const d = byId(b.declarationId);
              return (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-stone-300">
                    {nickOf(view, room, b.playerId)}:
                  </span>
                  <span>
                    {d ? <SuitText text={formatDeclaration(d, lang)} /> : b.declarationId}
                  </span>
                </li>
              );
            })}
          </ol>
          <EventLog log={log} view={view} room={room} />
        </div>
      </aside>
    </div>
  );
}

function EventLog({
  log,
  view,
  room,
}: {
  log: { id: number; event: ServerEvent }[];
  view: PlayerView;
  room: RoomState;
}) {
  const { t } = useTranslation();
  const lines = log
    .filter((l) => l.event.type === 'AUTO_PLAYED' || l.event.type === 'ELIMINATION_REASON')
    .slice(-3);
  if (!lines.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-white/10 pt-2 text-xs text-amber-200">
      {lines.map(({ id, event }) => {
        const nick = nickOf(view, room, String(event.playerId));
        return (
          <li key={id}>
            {event.type === 'AUTO_PLAYED'
              ? t('table.log.autoPlayed', { nick })
              : t(`table.log.eliminationReason.${String(event.reason)}`, { nick })}
          </li>
        );
      })}
    </ul>
  );
}

function ActionPanel({
  view,
  room,
  declarations,
  myTurn,
  isPlayer,
  now,
}: {
  view: PlayerView;
  room: RoomState;
  declarations: Declaration[];
  myTurn: boolean;
  isPlayer: boolean;
  now: number;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const minDecl = declarations[view.allowedDeclarationMinOrder];
  const kickVote = room.kickVote;
  const targetNick = nickOf(view, room, view.currentTurn);

  return (
    <div className="panel space-y-3">
      <p className={`text-center text-lg font-bold ${myTurn ? 'text-gold' : 'text-stone-200'}`}>
        {myTurn ? t('table.yourTurn') : t('table.turnOf', { nick: targetNick })}
      </p>

      {!isPlayer && <p className="text-center text-sm text-stone-300">{t('table.spectating')}</p>}

      {isPlayer && myTurn && (
        <>
          <button
            className="btn-danger w-full py-3 text-lg"
            disabled={!view.canCheck}
            onClick={() => void check()}
          >
            {t('table.check')}
          </button>
          {minDecl ? (
            <>
              <button
                className="btn-ghost w-full text-sm"
                onClick={() => void declare(minDecl.id)}
                title={formatDeclaration(minDecl, lang)}
              >
                {t('table.minRaise')}: {formatDeclaration(minDecl, lang)}
              </button>
              <div className="border-t border-white/10 pt-3">
                <DeclarationPicker
                  key={view.bids.length}
                  declarations={declarations}
                  settings={view.settings}
                  minOrder={view.allowedDeclarationMinOrder}
                  onSubmit={(id) => void declare(id)}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-200">{t('table.maxBid')}</p>
          )}
        </>
      )}

      {isPlayer && !myTurn && (
        <p className="text-center text-sm text-stone-300">{t('table.waiting')}</p>
      )}

      {isPlayer && kickVote && kickVote.targetId !== view.me && (
        <KickVote view={view} room={room} now={now} targetNick={targetNick} />
      )}
    </div>
  );
}

function KickVote({
  view,
  room,
  now,
  targetNick,
}: {
  view: PlayerView;
  room: RoomState;
  now: number;
  targetNick: string;
}) {
  const { t } = useTranslation();
  const vote = room.kickVote;
  if (!vote) return null;
  const eligible = view.players.filter((p) => !p.eliminated && p.id !== vote.targetId).length;
  const needed = Math.floor(eligible / 2) + 1;
  const wait = Math.ceil((vote.availableAt - now) / 1000);
  const iVoted = vote.votes.includes(view.me);
  return (
    <div className="border-t border-white/10 pt-3 text-center text-sm">
      {wait > 0 ? (
        <p className="text-xs text-stone-400">{t('table.voteKickWait', { sec: wait })}</p>
      ) : (
        <>
          <button
            className="btn-ghost w-full text-sm"
            disabled={iVoted}
            onClick={() => void voteKick(vote.targetId)}
          >
            {t('table.voteKick', { nick: targetNick })}
          </button>
          <p className="mt-1 text-xs text-stone-300">
            {t('table.votes', { count: vote.votes.length, needed })}
          </p>
        </>
      )}
    </div>
  );
}
