import type { AccountConditions, InstrumentRecord } from '../domain/types.ts';
import type { CatalogPage, CatalogQuery, Dimensions, FilterReference, Provider } from './provider.ts';
import type { LiveQuoteSource } from './source.ts';

function rfc3339(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Overlay a fresh live quote from the first source that supports this instrument
// onto its fixture record. Returns the record unchanged when no source has a
// fresh quote (graceful fallback to fixture data).
function overlayLiveQuote(rec: InstrumentRecord, sources: LiveQuoteSource[]): InstrumentRecord {
  for (const src of sources) {
    if (!src.supports(rec.instrument_id)) continue;
    const live = src.getQuote(rec.instrument_id);
    if (!live) continue;

    const digits = rec.spec.digits;
    let bidN: number;
    let askN: number;

    if (live.bid !== undefined && live.ask !== undefined) {
      // Two-sided feed (e.g. Binance bookTicker): use the upstream spread.
      bidN = Number(live.bid);
      askN = Number(live.ask);
      if (!Number.isFinite(bidN) || !Number.isFinite(askN) || askN < bidN) continue;
    } else if (live.mid !== undefined) {
      // Last/mid-only feed: take the live mid and keep the instrument's
      // configured spread (a catalog attribute), centred on the new mid.
      const midN = Number(live.mid);
      if (!Number.isFinite(midN) || midN <= 0) continue;
      const spreadAbs = Math.max(0, Number(rec.quote.ask) - Number(rec.quote.bid));
      bidN = midN - spreadAbs / 2;
      askN = midN + spreadAbs / 2;
    } else {
      continue;
    }

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
        quote_mode: src.quoteMode,
        delay_seconds: src.delaySeconds,
        last_quote_at: ts,
      },
      price_source: { ...rec.price_source, source_label: src.label, quote_mode: src.quoteMode, delay_seconds: src.delaySeconds },
      freshness: { ...rec.freshness, quote_updated_at: ts },
    };
  }
  return rec;
}

// Wraps a base Provider (fixtures) and overlays live upstream quotes from any
// configured sources (crypto via Binance, FX/metals/indices/shares via Twelve
// Data, ...). Asset classes with no live source wired pass through as fixtures.
export class CompositeProvider implements Provider {
  private readonly base: Provider;
  private readonly sources: LiveQuoteSource[];

  constructor(base: Provider, sources: LiveQuoteSource[]) {
    this.base = base;
    this.sources = sources;
  }

  async listCatalog(query: CatalogQuery): Promise<CatalogPage> {
    const page = await this.base.listCatalog(query);
    return { ...page, items: page.items.map((rec) => overlayLiveQuote(rec, this.sources)) };
  }

  async getInstrument(id: string, dims?: Dimensions): Promise<InstrumentRecord | null> {
    const rec = await this.base.getInstrument(id, dims);
    return rec ? overlayLiveQuote(rec, this.sources) : null;
  }

  getFilterReference(): FilterReference {
    return this.base.getFilterReference();
  }

  getAccountConditions(id: string, token: string): Promise<AccountConditions | null> {
    return this.base.getAccountConditions(id, token);
  }
}
