import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDeclaration, type Declaration, type PlayerView } from '@tayan/engine';
import { CardBack, PlayingCard, type Scale } from '../components/PlayingCard';
import { DeclarationPicker } from '../components/DeclarationPicker';
import { SuitText } from '../components/SuitIcon';
import { useDeclarations, useLang, useNow } from '../lib/hooks';
import { iconZoom, seatCardScale, useArtScale, useLayoutMode, useLayoutScale } from '../lib/scale';
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
  const art = useArtScale();
  const { rem } = useLayoutScale();
  const mode = useLayoutMode();
  const compact = mode !== 'wide';
  const [historyOpen, setHistoryOpen] = useState(false);
  // held upright there is room for two big cards; otherwise the smallest size that fits
  const handScale: Scale = mode === 'portrait' && view.myCards.length <= 2 ? 2 : art;
  // with many cards on a small screen they overlap, each showing at least its corner
  const cardW = 56 * handScale;
  const handRoom = mode === 'short' ? 200 : 300;
  const handStep = compact
    ? Math.max(
        24,
        Math.min(cardW + 8, Math.floor((handRoom - cardW) / Math.max(1, view.myCards.length - 1))),
      )
    : cardW + 12;
  const seatScale = seatCardScale(art);
  // a seat's size in rem: the card fan (136 sprite px per scale step) and ~3.5rem of text and padding
  const fanRem = (136 * seatScale) / rem;
  const halfW = Math.max(4, (fanRem + 1) / 2) + 0.5;
  const halfH = 1.75 + (40 * seatScale) / rem + 0.5;

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
    <div
      className={
        mode === 'short'
          ? 'flex h-full min-h-0 gap-2 p-2'
          : mode === 'portrait'
            ? 'flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2'
            : 'flex h-full min-h-0 flex-col gap-4 p-4'
      }
    >
      <div
        className={
          compact
            ? 'relative min-h-0 min-w-0 flex-1'
            : 'grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]'
        }
      >
        <div
          className={`table-shape wood-frame flex ${compact ? 'h-full min-h-[14rem] p-2' : 'min-h-[16rem] p-3'}`}
        >
          <div
            className="table-shape felt-texture relative flex-1"
            style={{
              containerType: 'size',
              ['--centre-w' as string]: mode === 'short' ? '42%' : '80%',
              ['--centre-top' as string]: mode === 'portrait' ? '52%' : '40%',
            }}
          >
            <div className="absolute left-1/2 top-[var(--centre-top,40%)] w-[min(18rem,var(--centre-w,80%))] -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-xs uppercase tracking-widest text-stone-300">
                {t('table.round', { n: view.roundNumber })}
              </p>
              <span className="pixel-rule mx-auto mt-1 block w-24" aria-hidden="true" />
              {lastDecl && lastBid ? (
                <div key={lastBid.declarationId} className="pop-in mt-1">
                  <p className="text-xs text-stone-300">
                    {t('table.lastBidBy', { nick: nickOf(view, room, lastBid.playerId) })}
                  </p>
                  <p
                    className="font-bold leading-tight text-gold"
                    style={{
                      fontSize: 'clamp(1rem, min(9cqh, 5cqw), var(--text-2xl))',
                      textShadow: '2px 2px 0 var(--color-ink)',
                    }}
                  >
                    <SuitText text={formatDeclaration(lastDecl, lang)} size={7 * iconZoom(rem)} />
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
              const cos = Math.cos(theta);
              const sin = Math.sin(theta);
              const active = view.currentTurn === p.id && !p.eliminated;
              return (
                <div
                  key={p.id}
                  className={`absolute flex w-max ${compact ? 'min-w-24' : 'min-w-32'} -translate-x-1/2 -translate-y-1/2 flex-col items-center border-4 px-2 py-1 text-center ${
                    active
                      ? 'plaque-active turn-blink border-gold bg-wood-light'
                      : 'plaque border-ink bg-panel'
                  } ${p.eliminated ? 'shake opacity-40 grayscale' : ''}`}
                  // snap to whole pixels so the sprites are not resampled unevenly
                  style={{
                    left: `round(nearest, calc(50% + (50% - ${halfW}rem) * ${cos.toFixed(4)}), 2px)`,
                    top: `round(nearest, calc(50% + (50% - ${halfH}rem) * ${sin.toFixed(4)}), 2px)`,
                  }}
                >
                  <p className="max-w-[8rem] truncate text-sm font-bold">
                    {p.nick}
                    {p.id === view.me && ' ★'}
                  </p>
                  {p.id !== view.me && (
                    <div className="mt-1 flex justify-center">
                      {Array.from({ length: Math.min(p.cardCount, 5) }).map((_, k) => (
                        <div
                          key={`${view.roundNumber}-${k}`}
                          className="deal-in"
                          style={{
                            marginLeft: k === 0 ? 0 : -36 * seatScale,
                            animationDelay: `${(i * 2 + k) * 90}ms`,
                          }}
                        >
                          <CardBack scale={seatScale} />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-0.5 text-[0.95rem] text-stone-300">
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

        {compact && (
          <button
            className="btn-ghost absolute bottom-3 right-3 px-2 py-0.5 text-sm"
            aria-label={t('table.bidHistory')}
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            ≡
          </button>
        )}
        <aside
          className={
            compact
              ? `panel absolute bottom-14 right-3 z-10 max-h-[70%] w-56 overflow-y-auto ${historyOpen ? '' : 'hidden'}`
              : 'panel max-h-40 min-h-0 overflow-y-auto xl:max-h-none'
          }
        >
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
        </aside>
      </div>

      {/* the player's area: cards and actions next to each other */}
      {(() => {
        const hand = (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-stone-300">{t('table.myCards')}</h3>
            {view.myCards.length ? (
              <div className="flex">
                {view.myCards.map((c, idx) => (
                  <div
                    key={`${view.roundNumber}-${c.rank}${c.suit}`}
                    className="deal-in"
                    style={{
                      animationDelay: `${idx * 130}ms`,
                      marginLeft: idx === 0 ? 0 : handStep - cardW,
                    }}
                  >
                    <PlayingCard card={c} scale={handScale} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">{isPlayer ? '' : t('table.spectating')}</p>
            )}
          </div>
        );
        const actions = (withHand: boolean) => (
          <ActionPanel
            view={view}
            room={room}
            declarations={declarations}
            myTurn={myTurn}
            isPlayer={isPlayer}
            now={now}
            handSlot={withHand ? hand : undefined}
          />
        );
        return mode === 'short' ? (
          <div className="panel w-[26rem] shrink-0 overflow-y-auto" style={{ padding: '0.5rem' }}>
            {actions(true)}
          </div>
        ) : (
          <div className="panel grid shrink-0 gap-x-6 gap-y-3 lg:grid-cols-[auto_minmax(0,1fr)]">
            {hand}
            {actions(false)}
          </div>
        );
      })()}
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
    <ul className="pixel-rule-top mt-3 space-y-1 pt-3 text-xs text-amber-200">
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
  handSlot,
}: {
  view: PlayerView;
  room: RoomState;
  declarations: Declaration[];
  myTurn: boolean;
  isPlayer: boolean;
  now: number;
  /** The player's cards, shown next to the turn status (used when height is scarce). */
  handSlot?: ReactNode;
}) {
  const { t } = useTranslation();
  const compact = useLayoutMode() !== 'wide';
  const minDecl = declarations[view.allowedDeclarationMinOrder];
  const kickVote = room.kickVote;
  const targetNick = nickOf(view, room, view.currentTurn);

  const statusRow = (
    <div className="flex flex-wrap items-center gap-3">
      <p className={`text-lg font-bold ${myTurn ? 'text-gold' : 'text-stone-200'}`}>
        {myTurn ? t('table.yourTurn') : t('table.turnOf', { nick: targetNick })}
      </p>
      {isPlayer && myTurn && (
        <button
          className={`btn-danger ml-auto ${compact ? 'px-3 py-1 text-base' : 'px-8 py-2 text-lg'}`}
          disabled={!view.canCheck}
          onClick={() => void check()}
        >
          {t('table.check')}
        </button>
      )}
    </div>
  );

  return (
    <div className={`flex min-w-0 flex-col ${handSlot ? 'gap-2' : 'gap-3'}`}>
      {handSlot ? (
        <div className="flex items-start gap-3">
          {handSlot}
          <div className="min-w-0 flex-1">{statusRow}</div>
        </div>
      ) : (
        statusRow
      )}

      {!isPlayer && <p className="text-sm text-stone-300">{t('table.spectating')}</p>}

      {isPlayer && myTurn && (
        <div className="border-t-4 border-ink pt-2">
          {minDecl ? (
            <DeclarationPicker
              key={view.bids.length}
              declarations={declarations}
              settings={view.settings}
              minOrder={view.allowedDeclarationMinOrder}
              onSubmit={(id) => void declare(id)}
            />
          ) : (
            <p className="text-sm text-amber-200">{t('table.maxBid')}</p>
          )}
        </div>
      )}

      {isPlayer && !myTurn && <p className="text-sm text-stone-300">{t('table.waiting')}</p>}

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
  // nothing is shown until the vote is possible; a countdown to it would only be noise
  if (vote.availableAt > now) return null;
  const iVoted = vote.votes.includes(view.me);
  return (
    <div className="pixel-rule-top pt-4 text-center text-sm">
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
    </div>
  );
}
