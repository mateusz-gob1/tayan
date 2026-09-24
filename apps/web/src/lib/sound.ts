/*
 * Chiptune sound effects, synthesised with WebAudio (square/triangle waves and noise), so there
 * are no audio files. All the "feel" lives in the SOUNDS table at the bottom: change a note or a
 * length there and reload.
 */

const MUTE_KEY = 'tayan.muted';
const MASTER_VOLUME = 0.6;

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

/** Browsers only start audio after a user gesture, so failures are silently ignored. */
function audio(): AudioContext | null {
  if (isMuted()) return null;
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Wave = 'square' | 'triangle' | 'sawtooth';

type Tone = {
  freq: number;
  /** Glide to this frequency over the note (pitch slide, like a sfxr sweep). */
  to?: number;
  /** Length in seconds. */
  dur: number;
  wave?: Wave;
  vol?: number;
  /** Start offset in seconds. */
  at?: number;
};

function tone(c: AudioContext, n: Tone): void {
  const t = c.currentTime + (n.at ?? 0);
  const vol = (n.vol ?? 0.12) * MASTER_VOLUME;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = n.wave ?? 'square';
  osc.frequency.setValueAtTime(n.freq, t);
  if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.setValueAtTime(vol, t + n.dur * 0.6);
  gain.gain.linearRampToValueAtTime(0.0001, t + n.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + n.dur + 0.02);
}

type Noise = { dur: number; vol?: number; at?: number; highpass?: number };

/** A burst of white noise with a quick decay: the 8-bit stand-in for a card sliding or flipping. */
function noise(c: AudioContext, n: Noise): void {
  const t = c.currentTime + (n.at ?? 0);
  const length = Math.max(1, Math.floor(c.sampleRate * n.dur));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = n.highpass ?? 2500;
  const gain = c.createGain();
  const vol = (n.vol ?? 0.1) * MASTER_VOLUME;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
}

// note frequencies (Hz)
const N = {
  G3: 196,
  A3: 220,
  C4: 262,
  E4: 330,
  F4: 349,
  G4: 392,
  A4: 440,
  C5: 523,
  D5: 587,
  E5: 659,
  G5: 784,
  A5: 880,
  C6: 1047,
  E6: 1319,
} as const;

function play(fn: (c: AudioContext) => void): void {
  const c = audio();
  if (c) fn(c);
}

/** Every sound the game makes. Notes are in the table above; times in seconds. */
export const SOUNDS = {
  /** It is your turn: two rising blips. */
  turn: (c: AudioContext) => {
    tone(c, { freq: N.E5, dur: 0.09 });
    tone(c, { freq: N.A5, dur: 0.14, at: 0.1 });
  },
  /** A card is dealt: a short "shk" and a low tick. */
  deal: (c: AudioContext) => {
    noise(c, { dur: 0.06, highpass: 3000, vol: 0.09 });
    tone(c, { freq: 220, to: 110, dur: 0.04, vol: 0.06 });
  },
  /** A card is turned over at the reveal. */
  flip: (c: AudioContext) => {
    noise(c, { dur: 0.045, highpass: 4500, vol: 0.09 });
    tone(c, { freq: 1200, to: 1800, dur: 0.035, at: 0.02, vol: 0.05 });
  },
  /** Someone declares a hand. */
  declare: (c: AudioContext) => {
    tone(c, { freq: N.D5, dur: 0.06 });
    tone(c, { freq: N.G5, dur: 0.08, at: 0.06 });
  },
  /** Someone checks: two falling notes, a small drum roll of suspense. */
  check: (c: AudioContext) => {
    tone(c, { freq: N.G4, dur: 0.12 });
    tone(c, { freq: N.C4, dur: 0.22, at: 0.13, vol: 0.14 });
  },
  /** A player gets an extra card: a low falling slide. */
  award: (c: AudioContext) => {
    tone(c, { freq: 330, to: 110, dur: 0.28, wave: 'triangle', vol: 0.2 });
  },
  /** A player is out: falling notes and a crash of noise. */
  eliminated: (c: AudioContext) => {
    [N.C5, N.A4, N.F4, N.C4].forEach((freq, i) => tone(c, { freq, dur: 0.11, at: i * 0.11 }));
    noise(c, { dur: 0.3, at: 0.4, highpass: 800, vol: 0.1 });
  },
  /** You won: a rising arpeggio. */
  win: (c: AudioContext) => {
    [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6, N.E6].forEach((freq, i) =>
      tone(c, { freq, dur: 0.11, at: i * 0.1, vol: 0.13 }),
    );
  },
  /** The game ended and you did not win. */
  lose: (c: AudioContext) => {
    [N.G4, N.E4, N.C4].forEach((freq, i) =>
      tone(c, { freq, dur: 0.16, at: i * 0.16, wave: 'triangle', vol: 0.18 }),
    );
  },
  /** Any button press. */
  click: (c: AudioContext) => {
    tone(c, { freq: 900, dur: 0.025, vol: 0.05 });
  },
} as const;

export type SoundName = keyof typeof SOUNDS;

export function playSound(name: SoundName): void {
  play(SOUNDS[name]);
}

/** Plays a sound after a delay in ms (for sequences such as a whole deal). */
export function playSoundAfter(name: SoundName, ms: number): number {
  return window.setTimeout(() => playSound(name), ms);
}

export const playTurnSound = () => playSound('turn');

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
