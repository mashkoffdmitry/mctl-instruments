// Live forex / metals / indices / shares quotes from Twelve Data.
// A single batched /quote call (comma-separated symbols) covers every non-crypto
// instrument per tick, which keeps free-tier usage well under the 800 req/day
// quota at the default 120s cadence (~720/day). Disabled unless TWELVEDATA_API_KEY
// is set; on any error the cache goes stale and callers fall back to fixtures.
//
// Honesty: the free tier is delayed, so the source reports quote_mode='delayed'
// with a conservative delay. Set TWELVEDATA_REALTIME=true (paid/WS plan) to
// advertise real_time. Twelve Data's /quote may omit bid/ask on some tiers; when
// only a last price is returned the overlay reconstructs bid/ask from the
// instrument's configured spread (see composite.ts).

import type { LiveQuote, LiveQuoteSource, SourceStatus } from './source.ts';
import type { QuoteMode } from '../domain/types.ts';

// instrument_id → Twelve Data symbol. Index symbols vary by vendor; verify
// against https://twelvedata.com/ before relying on idx.* in production (a wrong
// symbol simply yields no quote and falls back to the fixture).
const SYMBOL_MAP: Record<string, string> = {
  'fx.eurusd': 'EUR/USD',
  'fx.gbpjpy': 'GBP/JPY',
  'metal.xauusd': 'XAU/USD',
  'idx.us500': 'SPX',
  'idx.uk100': 'FTSE',
  'share.aapl': 'AAPL',
};

const API_KEY = process.env.TWELVEDATA_API_KEY ?? '';
const BASE = process.env.TWELVEDATA_BASE ?? 'https://api.twelvedata.com';
const POLL_MS = Number(process.env.TWELVEDATA_POLL_MS ?? 120_000);
const FRESH_MS = Number(process.env.TWELVEDATA_FRESH_MS ?? 300_000);
const REALTIME = (process.env.TWELVEDATA_REALTIME ?? 'false') === 'true';
const DELAY_SECONDS = Number(process.env.TWELVEDATA_DELAY_SECONDS ?? 900);

interface TwelveQuote {
  bid?: string;
  ask?: string;
  close?: string;
  price?: string;
  code?: number;
  status?: string;
}

export class TwelveDataClient implements LiveQuoteSource {
  readonly quoteMode: QuoteMode = REALTIME ? 'real_time' : 'delayed';
  readonly delaySeconds = REALTIME ? 0 : DELAY_SECONDS;
  readonly label = REALTIME ? 'Twelve Data (live)' : 'Twelve Data (delayed)';

  private readonly cache = new Map<string, LiveQuote>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;

  /** True only when an API key is configured — otherwise the source is inert. */
  static enabled(): boolean {
    return API_KEY.length > 0;
  }

  start(): void {
    if (this.timer || !API_KEY) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), POLL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  supports(instrumentId: string): boolean {
    return API_KEY.length > 0 && instrumentId in SYMBOL_MAP;
  }

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
    const ids = Object.keys(SYMBOL_MAP);
    const symbols = ids.map((id) => SYMBOL_MAP[id]!);
    try {
      const url = `${BASE}/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${encodeURIComponent(API_KEY)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, TwelveQuote> | TwelveQuote;
      const fetchedAtMs = Date.now();
      let parsed = 0;
      for (const id of ids) {
        const sym = SYMBOL_MAP[id]!;
        // Batched responses are keyed by symbol; a single symbol returns a flat object.
        const q: TwelveQuote | undefined = symbols.length > 1 ? (body as Record<string, TwelveQuote>)[sym] : (body as TwelveQuote);
        if (!q || q.status === 'error') continue;
        const live = toLiveQuote(q, fetchedAtMs);
        if (live) {
          this.cache.set(id, live);
          parsed += 1;
        }
      }
      this.lastError = parsed > 0 ? null : 'no quotes parsed';
    } catch (e) {
      this.lastError = (e as Error).message;
    }
  }
}

function toLiveQuote(q: TwelveQuote, fetchedAtMs: number): LiveQuote | null {
  const bidN = Number(q.bid);
  const askN = Number(q.ask);
  if (q.bid && q.ask && Number.isFinite(bidN) && Number.isFinite(askN) && askN >= bidN) {
    return { bid: q.bid, ask: q.ask, fetchedAtMs };
  }
  const midRaw = q.price ?? q.close;
  const midN = Number(midRaw);
  if (midRaw && Number.isFinite(midN) && midN > 0) {
    return { mid: midRaw, fetchedAtMs };
  }
  return null;
}
