import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A minimal stand-in for the browser's WebAudio API that records what is created.
function fakeAudio() {
  const created = { oscillators: 0, sources: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const node = () => ({ connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() });
  class FakeContext {
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator() {
      created.oscillators++;
      return { ...node(), type: 'square', frequency: param() };
    }
    createGain() {
      return { ...node(), gain: param() };
    }
    createBiquadFilter() {
      return { ...node(), type: 'highpass', frequency: param() };
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      created.sources++;
      return { ...node(), buffer: null };
    }
  }
  return { FakeContext, created };
}

describe('sound effects', () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('every sound can be played without errors and makes some noise', async () => {
    const { FakeContext, created } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    const { SOUNDS, playSound } = await import('../src/lib/sound');
    for (const name of Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]) {
      const before = created.oscillators + created.sources;
      expect(() => playSound(name), name).not.toThrow();
      expect(created.oscillators + created.sources, name).toBeGreaterThan(before);
    }
  });

  it('stays silent when muted', async () => {
    const { FakeContext, created } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    const { playSound, setMuted, isMuted } = await import('../src/lib/sound');
    setMuted(true);
    expect(isMuted()).toBe(true);
    playSound('win');
    expect(created.oscillators + created.sources).toBe(0);
  });

  it('does not break when audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playSound } = await import('../src/lib/sound');
    expect(() => playSound('turn')).not.toThrow();
  });
});

describe('sounds for game events', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  async function setup() {
    const played: string[] = [];
    vi.doMock('../src/lib/sound', () => ({
      playSound: (n: string) => played.push(n),
      playSoundAfter: (n: string, ms: number) => setTimeout(() => played.push(n), ms),
    }));
    const { soundForEvent } = await import('../src/lib/sfx');
    return { played, soundForEvent };
  }

  it("announces other players' declarations but not your own", async () => {
    const { played, soundForEvent } = await setup();
    soundForEvent({ type: 'DECLARED', playerId: 'me' }, 'me');
    soundForEvent({ type: 'DECLARED', playerId: 'bot' }, 'me');
    expect(played).toEqual(['declare']);
  });

  it('deals with a few quick sounds when a round starts', async () => {
    const { played, soundForEvent } = await setup();
    soundForEvent({ type: 'ROUND_STARTED', round: 1, starter: 'a' }, 'me');
    vi.advanceTimersByTime(2000);
    expect(played.filter((p) => p === 'deal')).toHaveLength(4);
  });

  it('turns cards over one by one and ends with the award sound', async () => {
    const { played, soundForEvent } = await setup();
    const hand = [{}, {}];
    soundForEvent({ type: 'REVEALED', result: { allHands: { a: hand, b: hand } } }, 'me');
    vi.advanceTimersByTime(5000);
    expect(played.filter((p) => p === 'flip')).toHaveLength(4);
    expect(played[played.length - 1]).toBe('award');
  });

  it('caps the number of flip sounds for a huge reveal', async () => {
    const { played, soundForEvent } = await setup();
    const big = Array.from({ length: 30 }, () => ({}));
    soundForEvent({ type: 'REVEALED', result: { allHands: { a: big } } }, 'me');
    vi.advanceTimersByTime(20_000);
    expect(played.filter((p) => p === 'flip')).toHaveLength(10);
  });

  it('plays a win or a lose jingle at the end depending on who won', async () => {
    const { played, soundForEvent } = await setup();
    soundForEvent({ type: 'GAME_OVER', winner: 'me' }, 'me');
    soundForEvent({ type: 'GAME_OVER', winner: 'bot' }, 'me');
    soundForEvent({ type: 'PLAYER_ELIMINATED', playerId: 'x' }, 'me');
    soundForEvent({ type: 'CHECKED', playerId: 'x' }, 'me');
    vi.advanceTimersByTime(3000);
    expect(played).toContain('win');
    expect(played).toContain('lose');
    expect(played).toContain('eliminated');
    expect(played).toContain('check');
  });
});
