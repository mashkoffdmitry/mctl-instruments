import type { AccountConditions, InstrumentRecord } from '../domain/types.ts';
import type { CatalogPage, CatalogQuery, FilterReference, Provider } from './provider.ts';
import { BinanceClient, isUpstreamSymbol } from './binance.ts';

function rfc3339(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Overlay a fresh live quote onto a crypto fixture record. Returns the record
// unchanged when no fresh upstream quote is available (graceful fallback).
function overlayLiveQuote(rec: InstrumentRecord, binance: BinanceClient): InstrumentRecord {
  if (!isUpstreamSymbol(rec.instrument_id)) return rec;
  const live = binance.getQuote(rec.instrument_id);
  if (!live) return rec;

  const digits = rec.spec.digits;
  const bidN = Number(live.bid);
  const askN = Number(live.ask);
  if (!Number.isFinite(bidN) || !Number.isFinite(askN) || askN < bidN) return rec;

  const bid = bidN.toFixed(digits);
  const ask = askN.toFixed(digits);
  const mid = ((bidN + askN) / 2).toFixed(digits);
  const spread = (askN - bidN).toFixed(digits);
  const ts = rfc3339(live.fetchedAtMs);

  return {
    ...rec,
    quote: {
      ...rec.quote,
      bid,
      ask,
      mid,
      current_spread_pips: spread,
      quote_mode: 'real_time',
      delay_seconds: 0,
      last_quote_at: ts,
    },
    price_source: { ...rec.price_source, source_label: 'Binance (live)', quote_mode: 'real_time', delay_seconds: 0 },
    freshness: { ...rec.freshness, quote_updated_at: ts },
  };
}

// Wraps a base Provider (fixtures) and overlays live upstream quotes where
// a real public feed exists (crypto via Binance). FX/indices/shares have no
// licensed public feed wired, so they pass through as fixture data.
export class CompositeProvider implements Provider {
  private readonly base: Provider;
  private readonly binance: BinanceClient;

  constructor(base: Provider, binance: BinanceClient) {
    this.base = base;
    this.binance = binance;
  }

  async listCatalog(query: CatalogQuery): Promise<CatalogPage> {
    const page = await this.base.listCatalog(query);
    return { ...page, items: page.items.map((rec) => overlayLiveQuote(rec, this.binance)) };
  }

  async getInstrument(id: string): Promise<InstrumentRecord | null> {
    const rec = await this.base.getInstrument(id);
    return rec ? overlayLiveQuote(rec, this.binance) : null;
  }

  getFilterReference(): FilterReference {
    return this.base.getFilterReference();
  }

  getAccountConditions(id: string, token: string): Promise<AccountConditions | null> {
    return this.base.getAccountConditions(id, token);
  }
}
