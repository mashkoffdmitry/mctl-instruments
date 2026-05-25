import type {
  AccountConditions,
  AssetClass,
  Category,
  InstrumentRecord,
  QuoteMode,
  TradingStatus,
} from '../domain/types.ts';
import { FIXTURES, type FixtureSeed } from '../fixtures/instruments.ts';
import type { CatalogPage, CatalogQuery, FilterReference, Provider } from './provider.ts';

// Fixture timestamps are anchored to process start, not per-request wall-clock,
// so cacheable representations (catalog/detail/schedule) are byte-stable and
// ETag/If-None-Match revalidation works. A real adapter (Phase 3) derives these
// from a live feed + schedule.
const ANCHOR = Date.now();

function rfc3339(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Stamp time-relative offsets from a fixture into concrete RFC 3339 timestamps.
function materialize(seed: FixtureSeed, now: number): InstrumentRecord {
  const t = seed.timing;
  const r = seed.record;
  return {
    ...r,
    quote: { ...r.quote, last_quote_at: rfc3339(now - t.quote_age_sec * 1000) },
    schedule: {
      ...r.schedule,
      next_open_at: t.next_open_in_sec === null ? null : rfc3339(now + t.next_open_in_sec * 1000),
      next_close_at: t.next_close_in_sec === null ? null : rfc3339(now + t.next_close_in_sec * 1000),
    },
    freshness: {
      quote_updated_at: rfc3339(now - t.quote_age_sec * 1000),
      schedule_updated_at: rfc3339(now - t.schedule_age_sec * 1000),
      config_updated_at: rfc3339(now - t.config_age_sec * 1000),
    },
  };
}

function isTradableNow(rec: InstrumentRecord): boolean {
  return rec.state.trading_status === 'enabled' && rec.state.session_state === 'open';
}

function matches(rec: InstrumentRecord, q: CatalogQuery): boolean {
  if (q.search) {
    const needle = q.search.toLowerCase();
    const hay = `${rec.symbol} ${rec.display_symbol} ${rec.display_name}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  if (q.asset_class && rec.asset_class !== q.asset_class) return false;
  if (q.category && rec.category !== q.category) return false;
  if (q.status && rec.state.trading_status !== q.status) return false;
  if (q.quote_mode && rec.quote.quote_mode !== q.quote_mode) return false;
  if (q.tradable_now !== undefined && isTradableNow(rec) !== q.tradable_now) return false;
  if (q.jurisdiction && !rec.jurisdictions.includes(q.jurisdiction)) return false;
  if (q.tags && q.tags.length > 0 && !q.tags.every((tag) => rec.tags.includes(tag))) return false;
  return true;
}

type Comparator = (a: InstrumentRecord, b: InstrumentRecord) => number;

function comparator(sort: string | undefined): Comparator {
  const spec = sort ?? '-popularity';
  const desc = spec.startsWith('-');
  const key = desc ? spec.slice(1) : spec;
  const dir = desc ? -1 : 1;
  return (a, b) => {
    let cmp = 0;
    if (key === 'popularity') cmp = a.popularity - b.popularity;
    else if (key === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
    else cmp = a.popularity - b.popularity;
    if (cmp === 0) cmp = a.instrument_id.localeCompare(b.instrument_id); // stable tiebreak
    return cmp * dir;
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown };
    const offset = typeof parsed.o === 'number' && Number.isInteger(parsed.o) && parsed.o >= 0 ? parsed.o : 0;
    return offset;
  } catch {
    throw new Error('invalid cursor');
  }
}

export class FixtureProvider implements Provider {
  async listCatalog(query: CatalogQuery): Promise<CatalogPage> {
    const all = FIXTURES.map((s) => materialize(s, ANCHOR))
      .filter((rec) => matches(rec, query))
      .sort(comparator(query.sort));

    const offset = decodeCursor(query.cursor);
    const items = all.slice(offset, offset + query.limit);
    const nextOffset = offset + query.limit;
    const next_cursor = nextOffset < all.length ? encodeCursor(nextOffset) : null;
    return { items, next_cursor };
  }

  async getInstrument(id: string): Promise<InstrumentRecord | null> {
    const seed = FIXTURES.find((s) => s.record.instrument_id === id);
    return seed ? materialize(seed, ANCHOR) : null;
  }

  getFilterReference(): FilterReference {
    const assetClasses: { id: AssetClass; label: string; sorting_order: number }[] = [
      { id: 'forex', label: 'Forex', sorting_order: 1 },
      { id: 'indices', label: 'Indices', sorting_order: 2 },
      { id: 'metals', label: 'Metals', sorting_order: 3 },
      { id: 'commodities', label: 'Commodities', sorting_order: 4 },
      { id: 'shares', label: 'Shares', sorting_order: 5 },
      { id: 'crypto', label: 'Crypto', sorting_order: 6 },
    ];
    const categories: { id: Category; asset_class: AssetClass; label: string }[] = [
      { id: 'major', asset_class: 'forex', label: 'Majors' },
      { id: 'minor', asset_class: 'forex', label: 'Minors / Crosses' },
      { id: 'exotic', asset_class: 'forex', label: 'Exotics' },
      { id: 'spot', asset_class: 'metals', label: 'Spot' },
      { id: 'cash', asset_class: 'indices', label: 'Cash' },
      { id: 'futures_based', asset_class: 'indices', label: 'Futures-based' },
    ];
    const statuses: { id: TradingStatus; label: string }[] = [
      { id: 'enabled', label: 'Tradable' },
      { id: 'close_only', label: 'Close only' },
      { id: 'disabled', label: 'Disabled' },
      { id: 'halt', label: 'Halted' },
      { id: 'break', label: 'Break' },
    ];
    const quoteModes: { id: QuoteMode; label: string }[] = [
      { id: 'real_time', label: 'Real-time' },
      { id: 'delayed', label: 'Delayed' },
      { id: 'indicative', label: 'Indicative' },
    ];
    const tagSet = new Set<string>();
    for (const s of FIXTURES) for (const tag of s.record.tags) tagSet.add(tag);
    const tags = [...tagSet].sort().map((id) => ({ id, label: id }));

    return { asset_classes: assetClasses, categories, statuses, quote_modes: quoteModes, tags };
  }

  async getAccountConditions(id: string, _token: string): Promise<AccountConditions | null> {
    const seed = FIXTURES.find((s) => s.record.instrument_id === id);
    if (!seed) return null;
    const r = seed.record;
    // Phase 1: synthesize a plausible personalized override from the public record.
    return {
      instrument_id: id,
      pricing_model: 'spread_plus_commission',
      commission: { amount: '3.50', currency: 'USD', basis: 'per_lot_per_side', minimum_commission: '0.00' },
      margin: {
        margin_model: 'dynamic_leverage',
        margin_currency: r.currencies.margin_currency,
        tiers: [
          { up_to_volume: '50', max_leverage: '1:500', margin_rate: '0.002' },
          { up_to_volume: '100', max_leverage: '1:200', margin_rate: '0.005' },
        ],
      },
      entitlements: { quote_mode: 'real_time', market_data_fee_required: false },
      restrictions: { available_in_region: true, trade_mode_override: r.state.trading_status },
    };
  }
}
