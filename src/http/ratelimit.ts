// Fixed-window per-key rate limiter (in-memory, single-process).
// Mirrors pelican's default 120 req/min/IP for anonymous traffic; private
// (token) traffic gets a higher budget.

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Returns retryAfterSeconds when over budget, otherwise null (allowed). */
  check(key: string): number | null {
    const now = Date.now();
    const w = this.windows.get(key);
    if (!w || now >= w.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return null;
    }
    if (w.count >= this.limit) {
      return Math.max(1, Math.ceil((w.resetAt - now) / 1000));
    }
    w.count += 1;
    return null;
  }

  /** Drop expired windows so the map doesn't grow unbounded. */
  sweep(): void {
    const now = Date.now();
    for (const [key, w] of this.windows) if (now >= w.resetAt) this.windows.delete(key);
  }
}
