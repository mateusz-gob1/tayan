import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const KEY = 'tayan.tutorialSeen';

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage unavailable: do not nag on every load
  }
}

/** One-time, skippable 3-card introduction shown on the first visit. */
export function Tutorial() {
  const { t } = useTranslation();
  const [step, setStep] = useState(seen() ? 0 : 1);
  if (step === 0) return null;

  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setStep(0);
  };
  const last = step === 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel pop-in w-full max-w-md bg-felt-dark/95" role="dialog" aria-modal="true">
        <p className="text-xs uppercase tracking-widest text-gold">{step} / 3</p>
        <h2 className="mt-1 text-2xl font-bold">{t(`tutorial.steps.${step}.title`)}</h2>
        <p className="mt-2 text-stone-200">{t(`tutorial.steps.${step}.body`)}</p>
        <div className="mt-5 flex items-center justify-between">
          <button className="text-sm text-stone-300 underline" onClick={finish}>
            {t('tutorial.skip')}
          </button>
          <button className="btn-primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? t('tutorial.done') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
