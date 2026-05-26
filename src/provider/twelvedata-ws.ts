// Real-time forex / metals / shares quotes from Twelve Data's WebSocket feed.
// The free tier exposes a SEPARATE budget from the REST /quote quota: one
// WebSocket connection with up to 8 subscribed symbols streaming real-time
// prices. We dedicate that budget to the 8 most-traded non-crypto instruments
// (EUR/USD, GBP/USD, USD/JPY, XAU/USD, AAPL, MSFT, NVDA, TSLA); everything else
// stays on the delayed REST source (twelvedata.ts). The two maps are disjoint
// so no symbol is charged twice.
//
// The feed only carries a last/mid price (event:'price'), so the overlay
// reconstructs bid/ask from the instrument's configured spread (see
// composite.ts). Uses Node 22+'s built-in WebSocket global — no dependency.
// Disabled unless TWELVEDATA_API_KEY is set; on disconnect it reconnects with
// exponential backoff and the cache goes stale (callers fall back to fixtures).

import type { LiveQuote, LiveQuoteSource, SourceStatus } from './source.ts';
import type { QuoteMode } from '../domain/types.ts';

// instrument_id → Twelve Data symbol. The 8 most-traded non-crypto instruments.
// MUST stay disjoint from the REST SYMBOL_MAP in twelvedata.ts.
const SYMBOL_MAP: Record<string, string> = {
  'fx.eurusd': 'EUR/USD',
  'fx.gbpusd': 'GBP/USD',
  'fx.usdjpy': 'USD/JPY',
  'metal.xauusd': 'XAU/USD',
  'share.aapl': 'AAPL',
  'share.msft': 'MSFT',
  'share.nvda': 'NVDA',
  'share.tsla': 'TSLA',
};

const API_KEY = process.env.TWELVEDATA_API_KEY ?? '';
const WS_URL = process.env.TWELVEDATA_WS_URL ?? 'wss://ws.twelvedata.com/v1/quotes/price';
// A quote older than this is treated as unavailable (callers fall back).
const FRESH_MS = Number(process.env.TWELVEDATA_WS_FRESH_MS ?? 120_000);
// Reconnect backoff bounds.
const BACKOFF_MIN_MS = Number(process.env.TWELVEDATA_WS_BACKOFF_MIN_MS ?? 1_000);
const BACKOFF_MAX_MS = Number(process.env.TWELVEDATA_WS_BACKOFF_MAX_MS ?? 60_000);

interface PriceEvent {
  event?: string;
  symbol?: string;
  price?: number | string;
  status?: string;
  code?: number;
  message?: string;
}

export class TwelveDataWsClient implements LiveQuoteSource {
  readonly label = 'Twelve Data (live)';
  readonly quoteMode: QuoteMode = 'real_time';
  readonly delaySeconds = 0;

  // symbol (Twelve Data form) → live quote. Keyed by symbol because the feed
  // echoes the symbol, not the instrument_id.
  private readonly cache = new Map<string, LiveQuote>();
  private ws: WebSocket | null = null;
  private stopped = false;
  private lastError: string | null = null;
  private backoffMs = BACKOFF_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // instrument_id → symbol reverse not needed; we map id→symbol via SYMBOL_MAP.

  /** True only when an API key is configured — otherwise the source is inert. */
  static enabled(): boolean {
    return API_KEY.length > 0;
  }

  start(): void {
    if (!API_KEY || this.ws) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  supports(instrumentId: string): boolean {
    return API_KEY.length > 0 && instrumentId in SYMBOL_MAP;
  }

  getQuote(instrumentId: string): LiveQuote | null {
    const sym = SYMBOL_MAP[instrumentId];
    if (!sym) return null;
    const q = this.cache.get(sym);
    if (!q) return null;
    if (Date.now() - q.fetchedAtMs > FRESH_MS) return null;
    return q;
  }

  status(): SourceStatus {
    return { label: this.label, symbols: Object.values(SYMBOL_MAP), cached: this.cache.size, last_error: this.lastError };
  }

  private connect(): void {
    if (this.stopped) return;
    const url = `${WS_URL}?apikey=${encodeURIComponent(API_KEY)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.lastError = (e as Error).message;
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.backoffMs = BACKOFF_MIN_MS;
      this.lastError = null;
      const symbols = Object.values(SYMBOL_MAP).join(',');
      try {
        ws.send(JSON.stringify({ action: 'subscribe', params: { symbols } }));
      } catch (e) {
        this.lastError = (e as Error).message;
      }
    });

    ws.addEventListener('message', (ev: MessageEvent) => {
      this.onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
    });

    ws.addEventListener('error', () => {
      // The browser-style API surfaces no detail on error events; the close
      // handler runs next and drives the reconnect.
      this.lastError = 'websocket error';
    });

    ws.addEventListener('close', () => {
      if (this.ws === ws) this.ws = null;
      this.scheduleReconnect();
    });
  }

  private onMessage(raw: string): void {
    let msg: PriceEvent;
    try {
      msg = JSON.parse(raw) as PriceEvent;
    } catch {
      return;
    }
    if (msg.event !== 'price' || !msg.symbol || msg.price === undefined) return;
    const priceN = Number(msg.price);
    if (!Number.isFinite(priceN) || priceN <= 0) return;
    this.cache.set(msg.symbol, { mid: String(msg.price), fetchedAtMs: Date.now() });
    this.lastError = null;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer.unref();
  }
}
