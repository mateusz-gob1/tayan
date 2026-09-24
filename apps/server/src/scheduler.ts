/** Time source and timers; injectable so tests can control time. */
export interface Scheduler {
  now(): number;
  /** Runs `fn` after `ms`; returns a function that cancels it. */
  after(ms: number, fn: () => void): () => void;
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  after(ms, fn) {
    const t = setTimeout(fn, ms);
    t.unref();
    return () => clearTimeout(t);
  },
};

/** Deterministic scheduler for tests: time moves only through `advance`. */
export class ManualScheduler implements Scheduler {
  private time = 1_000_000;
  private tasks: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;

  now(): number {
    return this.time;
  }

  after(ms: number, fn: () => void): () => void {
    const id = this.nextId++;
    this.tasks.push({ at: this.time + ms, fn, id });
    return () => {
      this.tasks = this.tasks.filter((t) => t.id !== id);
    };
  }

  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = this.tasks
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.tasks = this.tasks.filter((t) => t.id !== due.id);
      this.time = Math.max(this.time, due.at);
      due.fn();
    }
    this.time = target;
  }
}
