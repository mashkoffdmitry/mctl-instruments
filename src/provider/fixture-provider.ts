import type {
  AccountConditions,
  AccountType,
  AssetClass,
  Category,
  Execution,
  FillingMode,
  InstrumentRecord,
  MarginMode,
  Platform,
  QuoteMode,
  TradingStatus,
} from '../domain/types.ts';
import { FIXTURES, type FixtureSeed } from '../fixtures/instruments.ts';
import { computeSession } from '../domain/session.ts';
import type { CatalogPage, CatalogQuery, Dimensions, FilterReference, Provider } from './provider.ts';

function rfc3339(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const DEFAULT_ACCOUNT: AccountType = 'standard';
const DEFAULT_PLATFORM: Platform = 'mt5';

function marginModeFor(assetClass: AssetClass): MarginMode {
  if (assetClass === 'forex' || assetClass === 'metals') return 'forex';
  if (assetClass === 'crypto') return 'cfd_leverage';
  return 'cfd';
}

function fillingModesFor(platform: Platform): FillingMode[] {
  if (platform === 'mt4') return ['fok', 'return'];
  if (platform === 'native') return ['ioc'];
  return ['fok', 'ioc', 'return']; // mt5
}

function executionFor(assetClass: AssetClass, platform: Platform): Execution {
  const exchangeLike = assetClass === 'shares';
  return {
    execution_mode: exchangeLike ? 'exchange' : 'market',
    filling_modes: fillingModesFor(platform),
    stop_level: assetClass === 'forex' ? '0' : assetClass === 'crypto' ? '50' : '20',
    freeze_level: assetClass === 'forex' ? '0' : '10',
    limit_stop_orders_allowed: true,
    short_selling: assetClass !== 'shares',
  };
}

// Account-type variance: raw accounts get tighter spreads + explicit commission,
// pro sits between. Multiplies the displayed spread and sets a commission.
function accountSpreadFactor(account: AccountType): number {
  return account === 'raw' ? 0.4 : account === 'pro' ? 0.7 : 1;
}

function scaleDecimal(value: string, factor: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const decimals = value.includes('.') ? value.split('.')[1]!.length : 1;
  return (n * factor).toFixed(decimals);
}

// Materialize a fixture: derive live session, stamp freshness, inject the
// MetaTrader-style execution + margin fields, and apply account/platform variance.
function materialize(seed: FixtureSeed, now: number = Date.now(), dims: Dimensions = {}): InstrumentRecord {
  const t = seed.timing;
  const r = seed.record;
  const account = dims.account_type ?? DEFAULT_ACCOUNT;
  const platform = dims.platform ?? DEFAULT_PLATFORM;
  const session = computeSession(r.schedule, now);
  const factor = accountSpreadFactor(account);

  const tc = r.trading_conditions;
  const trading_conditions =
    factor === 1
      ? tc
      : {
          ...tc,
          pricing_model: 'spread_plus_commission' as const,
          typical_spread: { ...tc.typical_spread, value_pips: scaleDecimal(tc.typical_spread.value_pips, factor) },
          commission: { ...tc.commission, amount: account === 'raw' ? '3.50' : '2.00' },
        };

  return {
    ...r,
    account_type: account,
    platform,
    state: { ...r.state, session_state: session.session_state },
    quote: {
      ...r.quote,
      current_spread_pips: factor === 1 ? r.quote.current_spread_pips : scaleDecimal(r.quote.current_spread_pips, factor),
      last_quote_at: rfc3339(now - t.quote_age_sec * 1000),
    },
    trading_conditions,
    margin: {
      ...r.margin,
      margin_mode: marginModeFor(r.asset_class),
      initial_margin: { basis: 'auto', value: null },
      maintenance_margin: { basis: 'auto', value: null },
      hedged_margin: r.asset_class === 'forex' || r.asset_class === 'metals' ? '50%' : '100%',
    },
    execution: executionFor(r.asset_class, platform),
    schedule: {
      ...r.schedule,
      next_open_at: session.next_open_at,
      next_close_at: session.next_close_at,
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
    const dims: Dimensions = { account_type: query.account_type, platform: query.platform };
    const all = FIXTURES.map((s) => materialize(s, Date.now(), dims))
      .filter((rec) => matches(rec, query))
      .sort(comparator(query.sort));

    const offset = decodeCursor(query.cursor);
    const items = all.slice(offset, offset + query.limit);
    const nextOffset = offset + query.limit;
    const next_cursor = nextOffset < all.length ? encodeCursor(nextOffset) : null;
    return { items, next_cursor };
  }

  async getInstrument(id: string, dims: Dimensions = {}): Promise<InstrumentRecord | null> {
    const seed = FIXTURES.find((s) => s.record.instrument_id === id);
    return seed ? materialize(seed, Date.now(), dims) : null;
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
