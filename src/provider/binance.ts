// Live crypto quotes from Binance's public REST API (no auth).
// A background loop polls bookTicker for the mapped symbols and caches the
// latest bid/ask. If Binance is unreachable (egress blocked, region block,
// outage) the cache simply goes stale and callers fall back to fixtures.

import type { LiveQuote, LiveQuoteSource, SourceStatus } from './source.ts';
import type { QuoteMode } from '../domain/types.ts';

// instrument_id → Binance symbol.
const SYMBOL_MAP: Record<string, string> = {
  'crypto.btcusd': 'BTCUSDT',
  'crypto.ethusd': 'ETHUSDT',
};

const BINANCE_BASE = process.env.BINANCE_BASE ?? 'https://api.binance.com';
const POLL_MS = Number(process.env.BINANCE_POLL_MS ?? 5000);
// A quote older than this is treated as unavailable (callers fall back).
const FRESH_MS = Number(process.env.BINANCE_FRESH_MS ?? 30_000);

export class BinanceClient implements LiveQuoteSource {
  readonly label = 'Binance (live)';
  readonly quoteMode: QuoteMode = 'real_time';
  readonly delaySeconds = 0;

  private readonly cache = new Map<string, LiveQuote>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;

  start(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), POLL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  supports(instrumentId: string): boolean {
    return instrumentId in SYMBOL_MAP;
  }

  /** Fresh live quote for an instrument, or null when unavailable/stale. */
  getQuote(instrumentId: string): LiveQuote | null {
    const q = this.cache.get(instrumentId);
    if (!q) return null;
    if (Date.now() - q.fetchedAtMs > FRESH_MS) return null;
    return q;
  }

  status(): SourceStatus {
    return { label: this.label, symbols: Object.values(SYMBOL_MAP), cached: this.cache.size, last_error: this.lastError };
  }

  private async refresh(): Promise<void> {
    const entries = Object.entries(SYMBOL_MAP);
    await Promise.all(
      entries.map(async ([instrumentId, symbol]) => {
        try {
          const res = await fetch(`${BINANCE_BASE}/api/v3/ticker/bookTicker?symbol=${symbol}`, {
            signal: AbortSignal.timeout(4000),
            headers: { accept: 'application/json' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { bidPrice?: string; askPrice?: string };
          if (!body.bidPrice || !body.askPrice) throw new Error('missing prices');
          this.cache.set(instrumentId, { bid: body.bidPrice, ask: body.askPrice, fetchedAtMs: Date.now() });
          this.lastError = null;
        } catch (e) {
          this.lastError = `${symbol}: ${(e as Error).message}`;
        }
      }),
    );
  }
}

/** @deprecated prefer source.supports(); kept for back-compat. */
export function isUpstreamSymbol(instrumentId: string): boolean {
  return instrumentId in SYMBOL_MAP;
}
