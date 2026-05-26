// A live-quote source feeds real upstream prices into the CompositeProvider,
// which overlays them onto fixture records. Binance (crypto) and Twelve Data
// (forex / metals / indices / shares) both implement this interface so new
// upstreams slot in uniformly.
//
// A source reports its own freshness semantics (quoteMode + delaySeconds): a
// free/delayed feed is labelled honestly as `delayed` rather than pretending to
// be real-time. The overlay copies label/quoteMode/delaySeconds onto the
// record's price_source.

import type { QuoteMode } from '../domain/types.ts';

// A single upstream quote. A source may provide a two-sided bid/ask (e.g.
// Binance bookTicker) or only a last/mid price (e.g. a free last-price feed);
// the overlay reconstructs the missing side from the instrument's configured
// spread when only `mid` is present.
export interface LiveQuote {
  bid?: string;
  ask?: string;
  mid?: string;
  fetchedAtMs: number;
}

export interface SourceStatus {
  label: string;
  symbols: string[];
  cached: number;
  last_error: string | null;
}

export interface LiveQuoteSource {
  /** Shown as price_source.source_label on overlaid records. */
  readonly label: string;
  /** Honest quote mode for this source/tier. */
  readonly quoteMode: QuoteMode;
  /** Reported feed delay in seconds (0 for genuinely real-time). */
  readonly delaySeconds: number;

  start(): void;
  stop(): void;
  /** True when this source can quote the given instrument_id. */
  supports(instrumentId: string): boolean;
  /** Fresh live quote, or null when unavailable/stale (caller falls back). */
  getQuote(instrumentId: string): LiveQuote | null;
  status(): SourceStatus;
}
