import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { codeFromUrl, createRoom, joinRoom } from '../net/socket';
import { loadNick, useStore } from '../store';

export function Start() {
  const { t } = useTranslation();
  const [invite, setInvite] = useState(codeFromUrl());
  const [nick, setNick] = useState(loadNick());
  const [code, setCode] = useState(invite ?? '');
  const [busy, setBusy] = useState(false);
  const setNotice = useStore((s) => s.setNotice);

  const submit = async (action: 'create' | 'join') => {
    const clean = nick.trim();
    if (clean.length < 1 || clean.length > 16) return setNotice('INVALID_PAYLOAD');
    setBusy(true);
    const res = action === 'create' ? await createRoom(clean) : await joinRoom(code, clean);
    setBusy(false);
    if (!res.ok) setNotice(res.error.code);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-16">
      <h1>
        <Logo big />
      </h1>

      <div className="panel mt-10 w-full space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-300">{t('start.nick')}</span>
          <input
            className="input"
            value={nick}
            maxLength={16}
            autoFocus
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit(invite || code ? 'join' : 'create')}
          />
        </label>

        {invite ? (
          <>
            <p className="rounded-lg bg-white/10 px-3 py-2 text-center text-sm">
              {t('start.invited', { code: invite })}
            </p>
            <button
              className="btn-primary w-full"
              disabled={busy}
              onClick={() => void submit('join')}
            >
              {t('start.join')}
            </button>
            <button
              className="w-full text-sm text-stone-300 underline"
              onClick={() => {
                window.history.replaceState(null, '', '/');
                setInvite(null);
                setCode('');
              }}
            >
              {t('start.create')}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-primary w-full"
              disabled={busy}
              onClick={() => void submit('create')}
            >
              {t('start.create')}
            </button>
            <div className="flex items-center gap-3 text-xs uppercase text-stone-400">
              <span className="h-px flex-1 bg-white/15" />
              {t('start.or')}
              <span className="h-px flex-1 bg-white/15" />
            </div>
            <p className="text-sm text-stone-300">{t('start.joinHint')}</p>
            <div className="flex gap-2">
              <input
                className="input uppercase tracking-widest"
                value={code}
                maxLength={5}
                placeholder={t('start.codePlaceholder')}
                aria-label={t('start.code')}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 5 && void submit('join')}
              />
              <button
                className="btn-ghost"
                disabled={busy || code.length !== 5}
                onClick={() => void submit('join')}
              >
                {t('start.join')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
