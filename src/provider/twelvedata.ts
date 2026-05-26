// Live forex / metals / commodities / shares quotes from Twelve Data (REST).
// With ~40 mapped non-crypto symbols a single batched /quote call would burn the
// free tier's 8 requests/minute cap (1 credit per symbol per call), so the map
// is split into chunks of <=8 symbols and one chunk is fetched per poll tick in
// round-robin. At the default 18-minute cadence (one chunk/tick, 5 chunks) a
// full catalog refresh takes ~90 minutes and daily usage stays ~640 credits,
// comfortably under the 800/day quota. The 8 most-traded symbols are served by
// the separate real-time WebSocket source (twelvedata-ws.ts) and are NOT in
// this REST map, so the two sources never double-charge for the same symbol.
//
// Disabled unless TWELVEDATA_API_KEY is set; on any error the cache goes stale
// and callers fall back to fixtures.
//
// Honesty: the free REST tier is delayed, so the source reports
// quote_mode='delayed' with a conservative delay. Set TWELVEDATA_REALTIME=true
// (paid plan) to advertise real_time. Twelve Data's /quote may omit bid/ask on
// some tiers; when only a last price is returned the overlay reconstructs
// bid/ask from the instrument's configured spread (see composite.ts).

import type { LiveQuote, LiveQuoteSource, SourceStatus } from './source.ts';
import type { QuoteMode } from '../domain/types.ts';

// instrument_id → Twelve Data symbol (REST, delayed). The 8 WS symbols
// (fx.eurusd, fx.gbpusd, fx.usdjpy, metal.xauusd, share.aapl, share.msft,
// share.nvda, share.tsla) are deliberately excluded — they stream via
// twelvedata-ws.ts. Keep this map and the WS map disjoint.
const SYMBOL_MAP: Record<string, string> = {
  // FX (majors / minors / crosses / exotics not on the WS feed)
  'fx.gbpjpy': 'GBP/JPY',
  'fx.audusd': 'AUD/USD',
  'fx.usdchf': 'USD/CHF',
  'fx.usdcad': 'USD/CAD',
  'fx.nzdusd': 'NZD/USD',
  'fx.eurgbp': 'EUR/GBP',
  'fx.eurjpy': 'EUR/JPY',
  'fx.audjpy': 'AUD/JPY',
  'fx.eurchf': 'EUR/CHF',
  'fx.gbpchf': 'GBP/CHF',
  'fx.cadjpy': 'CAD/JPY',
  'fx.gbpaud': 'GBP/AUD',
  'fx.euraud': 'EUR/AUD',
  'fx.eurcad': 'EUR/CAD',
  'fx.audcad': 'AUD/CAD',
  'fx.audnzd': 'AUD/NZD',
  'fx.nzdjpy': 'NZD/JPY',
  'fx.chfjpy': 'CHF/JPY',
  'fx.gbpcad': 'GBP/CAD',
  'fx.eurnzd': 'EUR/NZD',
  'fx.usdsgd': 'USD/SGD',
  'fx.usdnok': 'USD/NOK',
  'fx.usdsek': 'USD/SEK',
  'fx.usdmxn': 'USD/MXN',
  'fx.usdzar': 'USD/ZAR',
  'fx.usdtry': 'USD/TRY',
  'fx.eurpln': 'EUR/PLN',
  'fx.eurhuf': 'EUR/HUF',
  // metals / commodities
  'metal.xagusd': 'XAG/USD',
  'commodity.wti': 'WTI/USD',
  'commodity.brent': 'BRENT/USD',
  'commodity.natgas': 'NG/USD',
  'commodity.copper': 'COPPER/USD',
  // large-cap US equities not on the WS feed
  'share.amzn': 'AMZN',
  'share.googl': 'GOOGL',
  'share.meta': 'META',
  'share.nflx': 'NFLX',
  'share.amd': 'AMD',
  'share.intc': 'INTC',
  'share.jpm': 'JPM',
  'share.v': 'V',
  'share.ko': 'KO',
};

const API_KEY = process.env.TWELVEDATA_API_KEY ?? '';
const BASE = process.env.TWELVEDATA_BASE ?? 'https://api.twelvedata.com';
// One chunk is fetched per tick; default 18 min keeps a full ~5-chunk cycle near
// 90 min and daily credits ~640 (under the 800/day free quota).
const POLL_MS = Number(process.env.TWELVEDATA_POLL_MS ?? 1_080_000);
// A quote older than this is treated as unavailable. Default covers two full
// refresh cycles so quotes don't churn to fixtures between chunk passes.
const FRESH_MS = Number(process.env.TWELVEDATA_FRESH_MS ?? 11_400_000);
// Max symbols per request, capped by the free tier's 8 requests/minute limit.
const CHUNK_SIZE = Math.max(1, Number(process.env.TWELVEDATA_CHUNK_SIZE ?? 8));
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
  // Round-robin cursor over the symbol-id chunks (one chunk fetched per tick).
  private readonly chunks: string[][] = chunk(Object.keys(SYMBOL_MAP), CHUNK_SIZE);
  private chunkIndex = 0;

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
    if (this.chunks.length === 0) return;
    // Fetch exactly one chunk this tick, then advance the round-robin cursor.
    const ids = this.chunks[this.chunkIndex % this.chunks.length]!;
    this.chunkIndex = (this.chunkIndex + 1) % this.chunks.length;
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
