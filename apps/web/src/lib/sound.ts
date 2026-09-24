const MUTE_KEY = 'tayan.muted';

let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage may be unavailable */
  }
}

/** Short, quiet two-note chime; browsers only allow audio after a user gesture, so failures are ignored. */
export function playTurnSound(): void {
  if (isMuted()) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.25);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.3);
    });
  } catch {
    /* audio unavailable */
  }
}

let blinkTimer: number | undefined;
let originalTitle = '';

/** Flashes the tab title until the tab is focused again. */
export function startTitleBlink(text: string): void {
  if (blinkTimer !== undefined || !document.hidden) return;
  originalTitle = document.title;
  let on = false;
  blinkTimer = window.setInterval(() => {
    on = !on;
    document.title = on ? text : originalTitle;
  }, 900);
  const stop = () => {
    if (document.hidden) return;
    stopTitleBlink();
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
}

export function stopTitleBlink(): void {
  if (blinkTimer !== undefined) {
    window.clearInterval(blinkTimer);
    blinkTimer = undefined;
    document.title = originalTitle;
  }
}
