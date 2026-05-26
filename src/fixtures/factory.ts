// Compact fixture factory. The first 7 catalog instruments are hand-authored
// (they showcase every state/edge case); the bulk of the catalog is generated
// from a terse per-instrument description plus sane defaults for all the
// boilerplate (permissions, disclosures, jurisdictions, execution-side margin,
// etc.). The representative bid/spread is only a plausible seed: the live
// overlay replaces the mid, and the REST mid-overlay reuses the spread, so the
// spread (ask-bid) must be realistic per asset class.

import type {
  AssetClass,
  Category,
  SessionInterval,
  SwapType,
  Weekday,
} from '../domain/types.ts';
import type { FixtureSeed } from './instruments.ts';

const HOUR = 3600;

// ---- schedule presets ----

const FOREX_24X5: SessionInterval[] = [
  { day: 'sun', open: '22:05', close: '23:59' },
  { day: 'mon', open: '00:00', close: '23:59' },
  { day: 'tue', open: '00:00', close: '23:59' },
  { day: 'wed', open: '00:00', close: '23:59' },
  { day: 'thu', open: '00:00', close: '23:59' },
  { day: 'fri', open: '00:00', close: '21:00' },
];

const CRYPTO_24X7: SessionInterval[] = (
  ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as Weekday[]
).map((day) => ({ day, open: '00:00', close: '23:59' }));

function weekdayWindow(open: string, close: string): SessionInterval[] {
  return (['mon', 'tue', 'wed', 'thu', 'fri'] as Weekday[]).map((day) => ({ day, open, close }));
}

// US cash equity session 13:30->20:00 UTC (09:30->16:00 ET).
const US_EQUITY: SessionInterval[] = weekdayWindow('13:30', '20:00');
// UK / EU cash session 08:00->16:30 UTC.
const UK_INDEX: SessionInterval[] = weekdayWindow('08:00', '16:30');
const EU_EQUITY: SessionInterval[] = weekdayWindow('08:00', '16:30');

export type SchedulePreset = 'forex24x5' | 'crypto24x7' | 'usEquity' | 'ukIndex' | 'euEquity';

const PRESET_INTERVALS: Record<SchedulePreset, SessionInterval[]> = {
  forex24x5: FOREX_24X5,
  crypto24x7: CRYPTO_24X7,
  usEquity: US_EQUITY,
  ukIndex: UK_INDEX,
  euEquity: EU_EQUITY,
};

const PRESET_TZ: Record<SchedulePreset, string> = {
  forex24x5: 'UTC',
  crypto24x7: 'UTC',
  usEquity: 'UTC',
  ukIndex: 'Europe/London',
  euEquity: 'UTC',
};

// ---- compact input ----

export interface MkSwaps {
  long: string;
  short: string;
  type?: SwapType; // default 'points'
  triple_swap_day?: Weekday; // default 'wed'
}

export interface MkInput {
  id: string;
  symbol: string;
  display_symbol: string;
  display_name: string;
  description?: string;
  asset_class: AssetClass;
  category: Category;
  digits: number;
  contract_size: string;
  base_currency: string;
  profit_currency: string;
  margin_currency: string;
  // A plausible representative quote. `bid` is the reference price; `spread` is
  // the absolute ask-bid distance (reused by the REST mid overlay). Both are in
  // the instrument's own price units (i.e. with `digits` precision).
  bid: number;
  spread: number;
  swaps: MkSwaps;
  schedule: SchedulePreset;
  tags: string[];
  popularity: number;
  // Simple fixed margin model defaults (per asset class) unless overridden.
  margin_rate_from?: string;
  max_leverage_from?: string;
  market_model?: 'otc' | 'exchange';
  source_label?: string;
  measurement_unit?: string;
}

// ---- defaults ----

function defaultMargin(assetClass: AssetClass): { rate: string; leverage: string } {
  switch (assetClass) {
    case 'forex':
      return { rate: '0.0333', leverage: '1:30' };
    case 'metals':
      return { rate: '0.05', leverage: '1:20' };
    case 'commodities':
      return { rate: '0.10', leverage: '1:10' };
    case 'shares':
      return { rate: '0.20', leverage: '1:5' };
    case 'indices':
      return { rate: '0.05', leverage: '1:20' };
    case 'crypto':
      return { rate: '0.50', leverage: '1:2' };
  }
}

function defaultMeasurementUnit(assetClass: AssetClass): string {
  switch (assetClass) {
    case 'forex':
      return 'units';
    case 'metals':
      return 'ounces';
    case 'commodities':
      return 'units';
    case 'shares':
      return 'shares';
    case 'indices':
      return 'index points';
    case 'crypto':
      return 'coins';
  }
}

function tickFromDigits(digits: number): string {
  if (digits <= 0) return '1';
  return `0.${'0'.repeat(digits - 1)}1`;
}

const DISCLOSURES = {
  spread: 'Текущий спред может меняться в зависимости от ликвидности и волатильности.',
  financing: 'Финансирование применяется к overnight позициям согласно условиям инструмента.',
} as const;

// Build a full FixtureSeed from a compact description. Pricing model is
// spread_only with zero commission, state is enabled/open (the session
// materializer recomputes session_state at request time), expiry null, margin a
// simple fixed model, jurisdictions ['global'], all permissions true.
export function mk(input: MkInput): FixtureSeed {
  const { digits } = input;
  const bid = input.bid;
  const ask = bid + input.spread;
  const mid = (bid + ask) / 2;
  const spreadPips = input.spread;
  const margin = defaultMargin(input.asset_class);
  const tickValue = (Number(input.contract_size) * Number(tickFromDigits(digits))).toString();

  return {
    timing: { quote_age_sec: 1, schedule_age_sec: 6 * HOUR, config_age_sec: 24 * HOUR },
    record: {
      instrument_id: input.id,
      symbol: input.symbol,
      display_symbol: input.display_symbol,
      display_name: input.display_name,
      description: input.description ?? input.display_name,
      asset_class: input.asset_class,
      category: input.category,
      tags: input.tags,
      jurisdictions: ['global'],
      state: { trading_status: 'enabled', session_state: 'open', status_reason_code: null },
      permissions: { can_open: true, can_close: true, can_modify_pending: true, can_modify_protection: true },
      quote: {
        bid: bid.toFixed(digits),
        ask: ask.toFixed(digits),
        mid: mid.toFixed(digits),
        current_spread_pips: spreadPips.toFixed(digits),
        spread_type: 'floating',
        quote_mode: 'delayed',
        delay_seconds: 900,
      },
      price_source: {
        market_model: input.market_model ?? (input.asset_class === 'shares' ? 'exchange' : 'otc'),
        source_label: input.source_label ?? 'Aggregated liquidity providers',
        quote_mode: 'delayed',
        delay_seconds: 900,
      },
      currencies: {
        base_currency: input.base_currency,
        profit_currency: input.profit_currency,
        margin_currency: input.margin_currency,
      },
      spec: {
        contract_size: input.contract_size,
        digits,
        tick_size: tickFromDigits(digits),
        tick_value: tickValue,
        measurement_unit: input.measurement_unit ?? defaultMeasurementUnit(input.asset_class),
      },
      trading_conditions: {
        min_volume: '0.01',
        max_volume: '100.00',
        volume_step: '0.01',
        pricing_model: 'spread_only',
        spread_type: 'floating',
        typical_spread: {
          value_pips: spreadPips.toFixed(digits),
          methodology_label: 'average spread',
          period_label: '12 weeks / trading hours window',
        },
        commission: { amount: '0.00', currency: input.profit_currency, basis: 'per_lot_round_turn' },
        swaps: {
          swap_type: input.swaps.type ?? 'points',
          long: input.swaps.long,
          short: input.swaps.short,
          triple_swap_day: input.swaps.triple_swap_day ?? 'wed',
        },
      },
      margin: {
        margin_model: 'fixed',
        margin_rate_from: input.margin_rate_from ?? margin.rate,
        max_leverage_from: input.max_leverage_from ?? margin.leverage,
        tiers: [],
      },
      schedule: {
        schedule_timezone: PRESET_TZ[input.schedule],
        regular_intervals: PRESET_INTERVALS[input.schedule],
        holiday_exceptions: [],
      },
      expiry_or_rollover_date: null,
      disclosures: { spread: DISCLOSURES.spread, financing: DISCLOSURES.financing },
      popularity: input.popularity,
    },
  };
}
