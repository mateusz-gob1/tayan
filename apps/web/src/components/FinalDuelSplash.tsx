import { useTranslation } from 'react-i18next';

/**
 * A brief retro-fighting-game "VS" splash, shown once when a game comes down to its last two
 * players (`Table.tsx` decides when to mount/unmount this). Purely decorative: no game state
 * lives here.
 */
export function FinalDuelSplash({ left, right }: { left: string; right: string }) {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className="pop-in absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-ink/90 text-center"
    >
      <p className="pixel-rule mb-1 w-32" />
      <p className="font-label text-xs uppercase tracking-[0.3em] text-stone-300">
        {t('table.finalDuel')}
      </p>
      <div className="flex items-center gap-4">
        <span
          key={`l-${left}`}
          className="deal-in max-w-[10rem] truncate font-display text-base text-gold"
          style={{ textShadow: '2px 2px 0 var(--color-ink)' }}
        >
          {left}
        </span>
        <span className="font-display text-2xl" style={{ color: 'var(--color-card-red)' }}>
          {t('table.vs')}
        </span>
        <span
          key={`r-${right}`}
          className="deal-in max-w-[10rem] truncate font-display text-base text-gold"
          style={{ textShadow: '2px 2px 0 var(--color-ink)', animationDelay: '90ms' }}
        >
          {right}
        </span>
      </div>
      <p className="pixel-rule mt-1 w-32" />
    </div>
  );
}
