import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shell } from './components/Shell';
import { connect } from './net/socket';
import { GameOver } from './screens/GameOver';
import { Lobby } from './screens/Lobby';
import { Reveal } from './screens/Reveal';
import { Start } from './screens/Start';
import { Table } from './screens/Table';
import { useStore } from './store';

function Waking() {
  const { t } = useTranslation();
  const conn = useStore((s) => s.conn);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-gold" />
      <h1 className="text-3xl font-bold text-gold">{t('conn.waking')}</h1>
      {conn === 'waking' && <p className="max-w-md text-stone-300">{t('conn.wakingHint')}</p>}
    </div>
  );
}

export default function App() {
  const everConnected = useStore((s) => s.everConnected);
  const session = useStore((s) => s.session);
  const room = useStore((s) => s.room);
  const view = useStore((s) => s.view);

  useEffect(() => {
    connect();
  }, []);

  if (!everConnected) return <Waking />;

  let screen;
  if (!session || !room) screen = session ? <Waking /> : <Start />;
  else if (room.phase === 'LOBBY' || !view) screen = <Lobby room={room} />;
  else if (view.phase === 'BIDDING') screen = <Table view={view} room={room} />;
  else if (view.phase === 'REVEAL') screen = <Reveal view={view} room={room} />;
  else screen = <GameOver view={view} room={room} />;

  return <Shell>{screen}</Shell>;
}
