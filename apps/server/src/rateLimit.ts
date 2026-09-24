/** Token bucket: `perSec` events per second with a burst of the same size. */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(private readonly perSec: number) {
    this.tokens = perSec;
  }

  allow(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.perSec, this.tokens + ((now - this.last) / 1000) * this.perSec);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
