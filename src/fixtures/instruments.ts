import type { InstrumentRecord, MarginProfile } from '../domain/types.ts';
import { mk } from './factory.ts';

// Margin fields the provider injects (margin_mode + initial/maintenance/hedged)
// so fixtures only declare the base rate/leverage/tiers.
type MarginSeed = Omit<MarginProfile, 'margin_mode' | 'initial_margin' | 'maintenance_margin' | 'hedged_margin'>;

// A fixture declares its instrument record plus time-relative offsets. The
// provider materializes the actual RFC 3339 timestamps at request time so demo
// states stay deterministic (an "open" instrument never drifts to "stale"
// just because the fixture file is old).
export interface FixtureTiming {
  quote_age_sec: number; // last_quote_at = now - this
  schedule_age_sec: number; // schedule_updated_at = now - this
  config_age_sec: number; // config_updated_at = now - this
}

export interface FixtureSeed {
  timing: FixtureTiming;
  record: Omit<InstrumentRecord, 'freshness' | 'quote' | 'schedule' | 'execution' | 'margin' | 'account_type' | 'platform'> & {
    quote: Omit<InstrumentRecord['quote'], 'last_quote_at'>;
    schedule: Omit<InstrumentRecord['schedule'], 'next_open_at' | 'next_close_at' | 'schedule_updated_at'>;
    margin: MarginSeed;
  };
}

const HOUR = 3600;

export const FIXTURES: FixtureSeed[] = [
  // 1) forex major — open, real-time
  {
    timing: { quote_age_sec: 1, schedule_age_sec: 6 * HOUR, config_age_sec: 18 * HOUR},
    record: {
      instrument_id: 'fx.eurusd',
      symbol: 'EURUSD',
      display_symbol: 'EUR/USD',
      display_name: 'Euro vs US Dollar',
      description: 'Euro against US Dollar',
      asset_class: 'forex',
      category: 'major',
      tags: ['popular', 'majors', 'tight-spread'],
      jurisdictions: ['eu', 'uk', 'global'],
      state: { trading_status: 'enabled', session_state: 'open', status_reason_code: null },
      permissions: { can_open: true, can_close: true, can_modify_pending: true, can_modify_protection: true },
      quote: { bid: '1.08452', ask: '1.08463', mid: '1.08458', current_spread_pips: '1.1', spread_type: 'floating', quote_mode: 'real_time', delay_seconds: 0 },
      price_source: { market_model: 'otc', source_label: 'Aggregated liquidity providers', quote_mode: 'real_time', delay_seconds: 0 },
      currencies: { base_currency: 'EUR', profit_currency: 'USD', margin_currency: 'USD' },
      spec: { contract_size: '100000', digits: 5, tick_size: '0.00001', tick_value: '1.00', measurement_unit: 'units' },
      trading_conditions: {
        min_volume: '0.01', max_volume: '100.00', volume_step: '0.01', pricing_model: 'spread_only', spread_type: 'floating',
        typical_spread: { value_pips: '0.8', methodology_label: 'average spread', period_label: '12 weeks / trading hours window' },
        commission: { amount: '0.00', currency: 'USD', basis: 'per_lot_round_turn' },
        swaps: { swap_type: 'points', long: '-6.5', short: '2.1', triple_swap_day: 'wed' },
      },
      margin: { margin_model: 'tiered', margin_rate_from: '0.005', max_leverage_from: '1:200', tiers: [
        { up_to_notional: '2000000', margin_rate: '0.005', max_leverage: '1:200' },
        { up_to_notional: '5000000', margin_rate: '0.010', max_leverage: '1:100' },
      ] },
      schedule: { schedule_timezone: 'UTC', regular_intervals: [
        { day: 'sun', open: '22:05', close: '23:59' },
        { day: 'mon', open: '00:00', close: '23:59' },
        { day: 'tue', open: '00:00', close: '23:59' },
        { day: 'wed', open: '00:00', close: '23:59' },
        { day: 'thu', open: '00:00', close: '23:59' },
        { day: 'fri', open: '00:00', close: '21:00' },
      ], holiday_exceptions: [] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'Текущий спред может меняться в зависимости от ликвидности и волатильности.',
        financing: 'Финансирование применяется к overnight позициям согласно условиям инструмента.',
      },
      popularity: 100,
    },
  },

  // 2) forex cross — open, DELAYED quote (15 min)
  {
    timing: { quote_age_sec: 900, schedule_age_sec: 6 * HOUR, config_age_sec: 20 * HOUR},
    record: {
      instrument_id: 'fx.gbpjpy',
      symbol: 'GBPJPY',
      display_symbol: 'GBP/JPY',
      display_name: 'British Pound vs Japanese Yen',
      description: 'British Pound against Japanese Yen',
      asset_class: 'forex',
      category: 'minor',
      tags: ['volatile', 'crosses'],
      jurisdictions: ['eu', 'uk', 'global'],
      state: { trading_status: 'enabled', session_state: 'open', status_reason_code: null },
      permissions: { can_open: true, can_close: true, can_modify_pending: true, can_modify_protection: true },
      quote: { bid: '197.842', ask: '197.871', mid: '197.856', current_spread_pips: '2.9', spread_type: 'floating', quote_mode: 'delayed', delay_seconds: 900 },
      price_source: { market_model: 'otc', source_label: 'Aggregated liquidity providers (delayed website feed)', quote_mode: 'delayed', delay_seconds: 900 },
      currencies: { base_currency: 'GBP', profit_currency: 'JPY', margin_currency: 'USD' },
      spec: { contract_size: '100000', digits: 3, tick_size: '0.001', tick_value: '0.67', measurement_unit: 'units' },
      trading_conditions: {
        min_volume: '0.01', max_volume: '50.00', volume_step: '0.01', pricing_model: 'spread_only', spread_type: 'floating',
        typical_spread: { value_pips: '2.4', methodology_label: 'average spread', period_label: '12 weeks / trading hours window' },
        commission: { amount: '0.00', currency: 'USD', basis: 'per_lot_round_turn' },
        swaps: { swap_type: 'points', long: '-12.0', short: '-3.5', triple_swap_day: 'wed' },
      },
      margin: { margin_model: 'fixed', margin_rate_from: '0.0333', max_leverage_from: '1:30', tiers: [] },
      schedule: { schedule_timezone: 'UTC', regular_intervals: [
        { day: 'sun', open: '22:05', close: '23:59' },
        { day: 'mon', open: '00:00', close: '23:59' },
        { day: 'tue', open: '00:00', close: '23:59' },
        { day: 'wed', open: '00:00', close: '23:59' },
        { day: 'thu', open: '00:00', close: '23:59' },
        { day: 'fri', open: '00:00', close: '21:00' },
      ], holiday_exceptions: [] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'Текущий спред плавающий и может расширяться при низкой ликвидности.',
        financing: 'Финансирование применяется к overnight позициям согласно условиям инструмента.',
      },
      popularity: 62,
    },
  },

  // 3) crypto — 24/7 open, real-time
  {
    timing: { quote_age_sec: 1, schedule_age_sec: 12 * HOUR, config_age_sec: 30 * HOUR},
    record: {
      instrument_id: 'crypto.btcusd',
      symbol: 'BTCUSD',
      display_symbol: 'BTC/USD',
      display_name: 'Bitcoin vs US Dollar',
      description: 'Bitcoin against US Dollar',
      asset_class: 'crypto',
      category: 'spot',
      tags: ['popular', 'crypto', '24-7'],
      jurisdictions: ['global'],
      state: { trading_status: 'enabled', session_state: 'open', status_reason_code: null },
      permissions: { can_open: true, can_close: true, can_modify_pending: true, can_modify_protection: true },
      quote: { bid: '68420.5', ask: '68437.0', mid: '68428.75', current_spread_pips: '16.5', spread_type: 'floating', quote_mode: 'real_time', delay_seconds: 0 },
      price_source: { market_model: 'otc', source_label: 'Aggregated crypto venues', quote_mode: 'real_time', delay_seconds: 0 },
      currencies: { base_currency: 'BTC', profit_currency: 'USD', margin_currency: 'USD' },
      spec: { contract_size: '1', digits: 1, tick_size: '0.1', tick_value: '0.1', measurement_unit: 'coins' },
      trading_conditions: {
        min_volume: '0.001', max_volume: '10.00', volume_step: '0.001', pricing_model: 'spread_only', spread_type: 'floating',
        typical_spread: { value_pips: '14.0', methodology_label: 'average spread', period_label: '4 weeks / 24h window' },
        commission: { amount: '0.00', currency: 'USD', basis: 'per_lot_round_turn' },
        swaps: { swap_type: 'percent', long: '-0.0411', short: '-0.0411', triple_swap_day: 'fri' },
      },
      margin: { margin_model: 'tiered', margin_rate_from: '0.50', max_leverage_from: '1:2', tiers: [
        { up_to_notional: '50000', margin_rate: '0.50', max_leverage: '1:2' },
        { up_to_notional: '200000', margin_rate: '1.00', max_leverage: '1:1' },
      ] },
      schedule: { schedule_timezone: 'UTC', regular_intervals: [
        { day: 'sun', open: '00:00', close: '23:59' },
        { day: 'mon', open: '00:00', close: '23:59' },
        { day: 'tue', open: '00:00', close: '23:59' },
        { day: 'wed', open: '00:00', close: '23:59' },
        { day: 'thu', open: '00:00', close: '23:59' },
        { day: 'fri', open: '00:00', close: '23:59' },
        { day: 'sat', open: '00:00', close: '23:59' },
      ], holiday_exceptions: [] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'Крипто-спреды могут существенно расширяться при высокой волатильности.',
        financing: 'Финансирование по крипто-CFD начисляется ежедневно.',
      },
      popularity: 88,
    },
  },

  // 4) index CFD — CLOSE ONLY (reduce-only session)
  {
    timing: { quote_age_sec: 2, schedule_age_sec: 6 * HOUR, config_age_sec: 26 * HOUR},
    record: {
      instrument_id: 'idx.us500',
      symbol: 'US500',
      display_symbol: 'US 500',
      display_name: 'US 500 Index CFD',
      description: 'CFD on the US 500 index',
      asset_class: 'indices',
      category: 'cash',
      tags: ['indices', 'popular'],
      jurisdictions: ['eu', 'uk', 'global'],
      state: { trading_status: 'close_only', session_state: 'open', status_reason_code: 'reduce_only_session' },
      permissions: { can_open: false, can_close: true, can_modify_pending: true, can_modify_protection: true },
      quote: { bid: '5310.4', ask: '5311.0', mid: '5310.7', current_spread_pips: '6.0', spread_type: 'floating', quote_mode: 'real_time', delay_seconds: 0 },
      price_source: { market_model: 'otc', source_label: 'Derived from underlying index futures', quote_mode: 'real_time', delay_seconds: 0 },
      currencies: { base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD' },
      spec: { contract_size: '1', digits: 1, tick_size: '0.1', tick_value: '0.1', measurement_unit: 'index points' },
      trading_conditions: {
        min_volume: '0.1', max_volume: '500.00', volume_step: '0.1', pricing_model: 'spread_only', spread_type: 'floating',
        typical_spread: { value_pips: '5.0', methodology_label: 'average spread', period_label: '12 weeks / cash session window' },
        commission: { amount: '0.00', currency: 'USD', basis: 'per_lot_round_turn' },
        swaps: { swap_type: 'points', long: '-1.2', short: '-0.8', triple_swap_day: 'fri' },
      },
      margin: { margin_model: 'fixed', margin_rate_from: '0.05', max_leverage_from: '1:20', tiers: [] },
      schedule: { schedule_timezone: 'UTC', regular_intervals: [
        { day: 'mon', open: '13:30', close: '20:00' },
        { day: 'tue', open: '13:30', close: '20:00' },
        { day: 'wed', open: '13:30', close: '20:00' },
        { day: 'thu', open: '13:30', close: '20:00' },
        { day: 'fri', open: '13:30', close: '20:00' },
      ], holiday_exceptions: [] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'Спред может расширяться вне основной сессии.',
        financing: 'Финансирование применяется к overnight позициям по индексным CFD.',
      },
      popularity: 71,
    },
  },

  // 5) metal CFD — MARKET CLOSED (weekend / outside session)
  {
    timing: { quote_age_sec: 8 * HOUR, schedule_age_sec: 6 * HOUR, config_age_sec: 40 * HOUR},
    record: {
      instrument_id: 'metal.xauusd',
      symbol: 'XAUUSD',
      display_symbol: 'XAU/USD',
      display_name: 'Gold vs US Dollar',
      description: 'Spot Gold against US Dollar',
      asset_class: 'metals',
      category: 'spot',
      tags: ['metals', 'safe-haven'],
      jurisdictions: ['eu', 'uk', 'global'],
      state: { trading_status: 'enabled', session_state: 'closed', status_reason_code: 'outside_session' },
      permissions: { can_open: false, can_close: false, can_modify_pending: true, can_modify_protection: true },
      quote: { bid: '2336.10', ask: '2336.55', mid: '2336.33', current_spread_pips: '45.0', spread_type: 'floating', quote_mode: 'delayed', delay_seconds: 28800 },
      price_source: { market_model: 'otc', source_label: 'Aggregated liquidity providers', quote_mode: 'delayed', delay_seconds: 28800 },
      currencies: { base_currency: 'XAU', profit_currency: 'USD', margin_currency: 'USD' },
      spec: { contract_size: '100', digits: 2, tick_size: '0.01', tick_value: '1.00', measurement_unit: 'ounces' },
      trading_conditions: {
        min_volume: '0.01', max_volume: '50.00', volume_step: '0.01', pricing_model: 'spread_only', spread_type: 'floating',
        typical_spread: { value_pips: '20.0', methodology_label: 'average spread', period_label: '12 weeks / trading hours window' },
        commission: { amount: '0.00', currency: 'USD', basis: 'per_lot_round_turn' },
        swaps: { swap_type: 'points', long: '-8.0', short: '3.0', triple_swap_day: 'wed' },
      },
      margin: { margin_model: 'fixed', margin_rate_from: '0.05', max_leverage_from: '1:20', tiers: [] },
      schedule: { schedule_timezone: 'UTC', regular_intervals: [
        { day: 'sun', open: '22:05', close: '23:59' },
        { day: 'mon', open: '00:00', close: '21:00' },
        { day: 'tue', open: '00:00', close: '21:00' },
        { day: 'wed', open: '00:00', close: '21:00' },
        { day: 'thu', open: '00:00', close: '21:00' },
        { day: 'fri', open: '00:00', close: '21:00' },
      ], holiday_exceptions: [] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'Перед закрытием рынка спред может расширяться, после открытия возможны гэпы.',
        financing: 'Финансирование применяется к overnight позициям по металлам.',
      },
      popularity: 76,
    },
  },

  // 6) share CFD — HALT (corporate action)
  {
    timing: { quote_age_sec: 120, schedule_age_sec: 6 * HOUR, config_age_sec: 50 * HOUR},
    record: {
      instrument_id: 'share.aapl',
      symbol: 'AAPL',
      display_symbol: 'AAPL',
      display_name: 'Apple Inc. CFD',
      description: 'CFD on Apple Inc. shares',
      asset_class: 'shares',
      category: 'cash',
      tags: ['shares', 'tech', 'us'],
      jurisdictions: ['eu', 'global'],
      state: { trading_status: 'halt', session_state: 'open', status_reason_code: 'corporate_action_pending' },
      permissions: { can_open: false, can_close: false, can_modify_pending: false, can_modify_protection: true },
      quote: { bid: '189.42', ask: '189.50', mid: '189.46', current_spread_pips: '8.0', spread_type: 'floating', quote_mode: 'delayed', delay_seconds: 120 },
      price_source: { market_model: 'exchange', source_label: 'NASDAQ', quote_mode: 'delayed', delay_seconds: 120 },
      currencies: { base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD' },
      spec: { contract_size: '1', digits: 2, tick_size: '0.01', tick_value: '0.01', measurement_unit: 'shares' },
      trading_conditions: {
        min_volume: '1', max_volume: '5000', volume_step: '1', pricing_model: 'spread_plus_commission', spread_type: 'floating',
        typical_spread: { value_pips: '6.0', methodology_label: 'average spread', period_label: '12 weeks / cash session window' },
        commission: { amount: '0.02', currency: 'USD', basis: 'percent_notional' },
        swaps: { swap_type: 'percent', long: '-0.0250', short: '-0.0150', triple_swap_day: 'fri' },
      },
      margin: { margin_model: 'fixed', margin_rate_from: '0.20', max_leverage_from: '1:5', tiers: [] },
      schedule: { schedule_timezone: 'UTC', regular_intervals: [
        { day: 'mon', open: '13:30', close: '20:00' },
        { day: 'tue', open: '13:30', close: '20:00' },
        { day: 'wed', open: '13:30', close: '20:00' },
        { day: 'thu', open: '13:30', close: '20:00' },
        { day: 'fri', open: '13:30', close: '20:00' },
      ], holiday_exceptions: [] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'Спред по акциям зависит от ликвидности базового рынка.',
        financing: 'Финансирование и дивидендные корректировки применяются к позициям по акциям.',
      },
      popularity: 58,
    },
  },

  // 7) index CFD — HOLIDAY (modified hours / early close)
  {
    timing: { quote_age_sec: 3, schedule_age_sec: 1 * HOUR, config_age_sec: 22 * HOUR},
    record: {
      instrument_id: 'idx.uk100',
      symbol: 'UK100',
      display_symbol: 'UK 100',
      display_name: 'UK 100 Index CFD',
      description: 'CFD on the UK 100 index',
      asset_class: 'indices',
      category: 'cash',
      tags: ['indices', 'uk'],
      jurisdictions: ['uk', 'eu', 'global'],
      state: { trading_status: 'enabled', session_state: 'holiday', status_reason_code: 'holiday_early_close' },
      permissions: { can_open: true, can_close: true, can_modify_pending: true, can_modify_protection: true },
      quote: { bid: '8204.5', ask: '8206.0', mid: '8205.25', current_spread_pips: '15.0', spread_type: 'floating', quote_mode: 'real_time', delay_seconds: 0 },
      price_source: { market_model: 'otc', source_label: 'Derived from underlying index futures', quote_mode: 'real_time', delay_seconds: 0 },
      currencies: { base_currency: 'GBP', profit_currency: 'GBP', margin_currency: 'USD' },
      spec: { contract_size: '1', digits: 1, tick_size: '0.1', tick_value: '0.1', measurement_unit: 'index points' },
      trading_conditions: {
        min_volume: '0.1', max_volume: '300.00', volume_step: '0.1', pricing_model: 'spread_only', spread_type: 'floating',
        typical_spread: { value_pips: '12.0', methodology_label: 'average spread', period_label: '12 weeks / cash session window' },
        commission: { amount: '0.00', currency: 'USD', basis: 'per_lot_round_turn' },
        swaps: { swap_type: 'points', long: '-1.0', short: '-0.6', triple_swap_day: 'fri' },
      },
      margin: { margin_model: 'fixed', margin_rate_from: '0.05', max_leverage_from: '1:20', tiers: [] },
      schedule: { schedule_timezone: 'Europe/London', regular_intervals: [
        { day: 'mon', open: '08:00', close: '16:30' },
        { day: 'tue', open: '08:00', close: '16:30' },
        { day: 'wed', open: '08:00', close: '16:30' },
        { day: 'thu', open: '08:00', close: '16:30' },
        { day: 'fri', open: '08:00', close: '16:30' },
      ], holiday_exceptions: [
        { name: 'Spring Bank Holiday', date: '2026-05-25', is_closed: false, early_close: '12:30', reopen: '00:00' },
        { name: 'Spring Bank Holiday', date: '2026-05-26', is_closed: false, early_close: '12:30', reopen: '00:00' },
      ] },
      expiry_or_rollover_date: null,
      disclosures: {
        spread: 'В праздничные дни действуют изменённые часы торгов и сниженная ликвидность.',
        financing: 'Финансирование применяется к overnight позициям по индексным CFD.',
      },
      popularity: 49,
    },
  },

  // ---- generated catalog (factory) ----
  // The 7 hand-authored fixtures above showcase every state/edge case; the bulk
  // below is generated from compact descriptions. Source assignment (Binance /
  // Twelve Data WS / Twelve Data REST) is wired in the provider SYMBOL_MAPs and
  // is independent of these fixtures (live overlay replaces the seed quote).

  // crypto — Binance (24/7, real-time). BTC is already hand-authored (#3).
  mk({ id: 'crypto.ethusd', symbol: 'ETHUSD', display_symbol: 'ETH/USD', display_name: 'Ethereum vs US Dollar', asset_class: 'crypto', category: 'spot', digits: 2, contract_size: '1', base_currency: 'ETH', profit_currency: 'USD', margin_currency: 'USD', bid: 3520.4, spread: 1.2, swaps: { long: '-0.0411', short: '-0.0411', type: 'percent', triple_swap_day: 'fri' }, schedule: 'crypto24x7', tags: ['popular', 'crypto', '24-7'], popularity: 84, source_label: 'Aggregated crypto venues' }),

  // ---- FX majors / minors / crosses (Twelve Data) ----
  // The 4 WS-routed FX/equity ids below also live as REST-free symbols (the REST
  // SYMBOL_MAP excludes them so the source sets stay disjoint).
  mk({ id: 'fx.gbpusd', symbol: 'GBPUSD', display_symbol: 'GBP/USD', display_name: 'British Pound vs US Dollar', asset_class: 'forex', category: 'major', digits: 5, contract_size: '100000', base_currency: 'GBP', profit_currency: 'USD', margin_currency: 'USD', bid: 1.27210, spread: 0.00012, swaps: { long: '-7.2', short: '1.8' }, schedule: 'forex24x5', tags: ['popular', 'majors', 'tight-spread'], popularity: 95 }),
  mk({ id: 'fx.usdjpy', symbol: 'USDJPY', display_symbol: 'USD/JPY', display_name: 'US Dollar vs Japanese Yen', asset_class: 'forex', category: 'major', digits: 3, contract_size: '100000', base_currency: 'USD', profit_currency: 'JPY', margin_currency: 'USD', bid: 156.842, spread: 0.012, swaps: { long: '4.1', short: '-9.8' }, schedule: 'forex24x5', tags: ['popular', 'majors', 'tight-spread'], popularity: 93 }),
  mk({ id: 'fx.audusd', symbol: 'AUDUSD', display_symbol: 'AUD/USD', display_name: 'Australian Dollar vs US Dollar', asset_class: 'forex', category: 'major', digits: 5, contract_size: '100000', base_currency: 'AUD', profit_currency: 'USD', margin_currency: 'USD', bid: 0.65420, spread: 0.00014, swaps: { long: '-2.1', short: '-1.4' }, schedule: 'forex24x5', tags: ['majors'], popularity: 80 }),
  mk({ id: 'fx.usdchf', symbol: 'USDCHF', display_symbol: 'USD/CHF', display_name: 'US Dollar vs Swiss Franc', asset_class: 'forex', category: 'major', digits: 5, contract_size: '100000', base_currency: 'USD', profit_currency: 'CHF', margin_currency: 'USD', bid: 0.90120, spread: 0.00018, swaps: { long: '1.2', short: '-5.4' }, schedule: 'forex24x5', tags: ['majors'], popularity: 72 }),
  mk({ id: 'fx.usdcad', symbol: 'USDCAD', display_symbol: 'USD/CAD', display_name: 'US Dollar vs Canadian Dollar', asset_class: 'forex', category: 'major', digits: 5, contract_size: '100000', base_currency: 'USD', profit_currency: 'CAD', margin_currency: 'USD', bid: 1.36540, spread: 0.00016, swaps: { long: '0.8', short: '-4.2' }, schedule: 'forex24x5', tags: ['majors'], popularity: 74 }),
  mk({ id: 'fx.nzdusd', symbol: 'NZDUSD', display_symbol: 'NZD/USD', display_name: 'New Zealand Dollar vs US Dollar', asset_class: 'forex', category: 'major', digits: 5, contract_size: '100000', base_currency: 'NZD', profit_currency: 'USD', margin_currency: 'USD', bid: 0.60110, spread: 0.00020, swaps: { long: '-1.9', short: '-1.1' }, schedule: 'forex24x5', tags: ['majors'], popularity: 64 }),
  mk({ id: 'fx.eurgbp', symbol: 'EURGBP', display_symbol: 'EUR/GBP', display_name: 'Euro vs British Pound', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'EUR', profit_currency: 'GBP', margin_currency: 'USD', bid: 0.85230, spread: 0.00022, swaps: { long: '-3.1', short: '-0.4' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 70 }),
  mk({ id: 'fx.eurjpy', symbol: 'EURJPY', display_symbol: 'EUR/JPY', display_name: 'Euro vs Japanese Yen', asset_class: 'forex', category: 'minor', digits: 3, contract_size: '100000', base_currency: 'EUR', profit_currency: 'JPY', margin_currency: 'USD', bid: 170.412, spread: 0.018, swaps: { long: '2.4', short: '-7.1' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 68 }),
  mk({ id: 'fx.audjpy', symbol: 'AUDJPY', display_symbol: 'AUD/JPY', display_name: 'Australian Dollar vs Japanese Yen', asset_class: 'forex', category: 'minor', digits: 3, contract_size: '100000', base_currency: 'AUD', profit_currency: 'JPY', margin_currency: 'USD', bid: 102.640, spread: 0.022, swaps: { long: '1.1', short: '-6.0' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 60 }),
  mk({ id: 'fx.eurchf', symbol: 'EURCHF', display_symbol: 'EUR/CHF', display_name: 'Euro vs Swiss Franc', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'EUR', profit_currency: 'CHF', margin_currency: 'USD', bid: 0.97840, spread: 0.00024, swaps: { long: '-2.0', short: '-1.6' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 55 }),
  mk({ id: 'fx.gbpchf', symbol: 'GBPCHF', display_symbol: 'GBP/CHF', display_name: 'British Pound vs Swiss Franc', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'GBP', profit_currency: 'CHF', margin_currency: 'USD', bid: 1.14620, spread: 0.00030, swaps: { long: '-1.4', short: '-2.2' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 50 }),
  mk({ id: 'fx.cadjpy', symbol: 'CADJPY', display_symbol: 'CAD/JPY', display_name: 'Canadian Dollar vs Japanese Yen', asset_class: 'forex', category: 'minor', digits: 3, contract_size: '100000', base_currency: 'CAD', profit_currency: 'JPY', margin_currency: 'USD', bid: 114.920, spread: 0.024, swaps: { long: '1.8', short: '-6.4' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 48 }),
  mk({ id: 'fx.gbpaud', symbol: 'GBPAUD', display_symbol: 'GBP/AUD', display_name: 'British Pound vs Australian Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'GBP', profit_currency: 'AUD', margin_currency: 'USD', bid: 1.94320, spread: 0.00040, swaps: { long: '-0.9', short: '-3.1' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 46 }),
  mk({ id: 'fx.euraud', symbol: 'EURAUD', display_symbol: 'EUR/AUD', display_name: 'Euro vs Australian Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'EUR', profit_currency: 'AUD', margin_currency: 'USD', bid: 1.65840, spread: 0.00038, swaps: { long: '-1.2', short: '-2.8' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 45 }),
  mk({ id: 'fx.eurcad', symbol: 'EURCAD', display_symbol: 'EUR/CAD', display_name: 'Euro vs Canadian Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'EUR', profit_currency: 'CAD', margin_currency: 'USD', bid: 1.48120, spread: 0.00036, swaps: { long: '-1.6', short: '-2.4' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 44 }),
  mk({ id: 'fx.audcad', symbol: 'AUDCAD', display_symbol: 'AUD/CAD', display_name: 'Australian Dollar vs Canadian Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'AUD', profit_currency: 'CAD', margin_currency: 'USD', bid: 0.89240, spread: 0.00034, swaps: { long: '-1.5', short: '-1.5' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 40 }),
  mk({ id: 'fx.audnzd', symbol: 'AUDNZD', display_symbol: 'AUD/NZD', display_name: 'Australian Dollar vs New Zealand Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'AUD', profit_currency: 'NZD', margin_currency: 'USD', bid: 1.08820, spread: 0.00042, swaps: { long: '-1.3', short: '-1.7' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 38 }),
  mk({ id: 'fx.nzdjpy', symbol: 'NZDJPY', display_symbol: 'NZD/JPY', display_name: 'New Zealand Dollar vs Japanese Yen', asset_class: 'forex', category: 'minor', digits: 3, contract_size: '100000', base_currency: 'NZD', profit_currency: 'JPY', margin_currency: 'USD', bid: 94.320, spread: 0.028, swaps: { long: '0.9', short: '-5.8' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 37 }),
  mk({ id: 'fx.chfjpy', symbol: 'CHFJPY', display_symbol: 'CHF/JPY', display_name: 'Swiss Franc vs Japanese Yen', asset_class: 'forex', category: 'minor', digits: 3, contract_size: '100000', base_currency: 'CHF', profit_currency: 'JPY', margin_currency: 'USD', bid: 174.020, spread: 0.030, swaps: { long: '2.0', short: '-7.4' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 36 }),
  mk({ id: 'fx.gbpcad', symbol: 'GBPCAD', display_symbol: 'GBP/CAD', display_name: 'British Pound vs Canadian Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'GBP', profit_currency: 'CAD', margin_currency: 'USD', bid: 1.73640, spread: 0.00044, swaps: { long: '-0.8', short: '-3.4' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 35 }),
  mk({ id: 'fx.eurnzd', symbol: 'EURNZD', display_symbol: 'EUR/NZD', display_name: 'Euro vs New Zealand Dollar', asset_class: 'forex', category: 'minor', digits: 5, contract_size: '100000', base_currency: 'EUR', profit_currency: 'NZD', margin_currency: 'USD', bid: 1.80420, spread: 0.00050, swaps: { long: '-1.0', short: '-3.0' }, schedule: 'forex24x5', tags: ['crosses'], popularity: 34 }),
  mk({ id: 'fx.usdsgd', symbol: 'USDSGD', display_symbol: 'USD/SGD', display_name: 'US Dollar vs Singapore Dollar', asset_class: 'forex', category: 'exotic', digits: 5, contract_size: '100000', base_currency: 'USD', profit_currency: 'SGD', margin_currency: 'USD', bid: 1.34820, spread: 0.00060, swaps: { long: '0.5', short: '-4.6' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 30 }),
  mk({ id: 'fx.usdnok', symbol: 'USDNOK', display_symbol: 'USD/NOK', display_name: 'US Dollar vs Norwegian Krone', asset_class: 'forex', category: 'exotic', digits: 4, contract_size: '100000', base_currency: 'USD', profit_currency: 'NOK', margin_currency: 'USD', bid: 10.6420, spread: 0.0080, swaps: { long: '2.2', short: '-9.0' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 28 }),
  mk({ id: 'fx.usdsek', symbol: 'USDSEK', display_symbol: 'USD/SEK', display_name: 'US Dollar vs Swedish Krona', asset_class: 'forex', category: 'exotic', digits: 4, contract_size: '100000', base_currency: 'USD', profit_currency: 'SEK', margin_currency: 'USD', bid: 10.4820, spread: 0.0090, swaps: { long: '2.0', short: '-8.6' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 27 }),
  mk({ id: 'fx.usdmxn', symbol: 'USDMXN', display_symbol: 'USD/MXN', display_name: 'US Dollar vs Mexican Peso', asset_class: 'forex', category: 'exotic', digits: 4, contract_size: '100000', base_currency: 'USD', profit_currency: 'MXN', margin_currency: 'USD', bid: 17.0420, spread: 0.0120, swaps: { long: '8.4', short: '-18.2' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 32 }),
  mk({ id: 'fx.usdzar', symbol: 'USDZAR', display_symbol: 'USD/ZAR', display_name: 'US Dollar vs South African Rand', asset_class: 'forex', category: 'exotic', digits: 4, contract_size: '100000', base_currency: 'USD', profit_currency: 'ZAR', margin_currency: 'USD', bid: 18.2420, spread: 0.0150, swaps: { long: '9.1', short: '-19.4' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 26 }),
  mk({ id: 'fx.usdtry', symbol: 'USDTRY', display_symbol: 'USD/TRY', display_name: 'US Dollar vs Turkish Lira', asset_class: 'forex', category: 'exotic', digits: 4, contract_size: '100000', base_currency: 'USD', profit_currency: 'TRY', margin_currency: 'USD', bid: 32.1420, spread: 0.0250, swaps: { long: '24.0', short: '-44.0' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 24 }),
  mk({ id: 'fx.eurpln', symbol: 'EURPLN', display_symbol: 'EUR/PLN', display_name: 'Euro vs Polish Zloty', asset_class: 'forex', category: 'exotic', digits: 4, contract_size: '100000', base_currency: 'EUR', profit_currency: 'PLN', margin_currency: 'USD', bid: 4.2820, spread: 0.0060, swaps: { long: '1.4', short: '-5.2' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 22 }),
  mk({ id: 'fx.eurhuf', symbol: 'EURHUF', display_symbol: 'EUR/HUF', display_name: 'Euro vs Hungarian Forint', asset_class: 'forex', category: 'exotic', digits: 3, contract_size: '100000', base_currency: 'EUR', profit_currency: 'HUF', margin_currency: 'USD', bid: 392.420, spread: 0.120, swaps: { long: '6.0', short: '-14.0' }, schedule: 'forex24x5', tags: ['exotics'], popularity: 20 }),

  // ---- metals / commodities (Twelve Data REST) ----
  mk({ id: 'metal.xagusd', symbol: 'XAGUSD', display_symbol: 'XAG/USD', display_name: 'Silver vs US Dollar', description: 'Spot Silver against US Dollar', asset_class: 'metals', category: 'spot', digits: 3, contract_size: '5000', base_currency: 'XAG', profit_currency: 'USD', margin_currency: 'USD', bid: 29.840, spread: 0.030, swaps: { long: '-6.0', short: '2.0' }, schedule: 'forex24x5', tags: ['metals'], popularity: 58 }),
  mk({ id: 'commodity.wti', symbol: 'WTI', display_symbol: 'WTI Oil', display_name: 'WTI Crude Oil', description: 'CFD on WTI crude oil', asset_class: 'commodities', category: 'spot', digits: 2, contract_size: '1000', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 78.42, spread: 0.05, swaps: { long: '-3.2', short: '-2.8' }, schedule: 'forex24x5', tags: ['commodities', 'energy'], popularity: 56, source_label: 'Derived from underlying futures' }),
  mk({ id: 'commodity.brent', symbol: 'BRENT', display_symbol: 'Brent Oil', display_name: 'Brent Crude Oil', description: 'CFD on Brent crude oil', asset_class: 'commodities', category: 'spot', digits: 2, contract_size: '1000', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 82.64, spread: 0.06, swaps: { long: '-3.4', short: '-2.6' }, schedule: 'forex24x5', tags: ['commodities', 'energy'], popularity: 54, source_label: 'Derived from underlying futures' }),
  mk({ id: 'commodity.natgas', symbol: 'NATGAS', display_symbol: 'Natural Gas', display_name: 'Natural Gas', description: 'CFD on natural gas', asset_class: 'commodities', category: 'spot', digits: 3, contract_size: '10000', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 2.842, spread: 0.008, swaps: { long: '-5.0', short: '-4.4' }, schedule: 'forex24x5', tags: ['commodities', 'energy'], popularity: 42, source_label: 'Derived from underlying futures' }),
  mk({ id: 'commodity.copper', symbol: 'COPPER', display_symbol: 'Copper', display_name: 'Copper', description: 'CFD on copper', asset_class: 'commodities', category: 'spot', digits: 4, contract_size: '25000', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 4.5820, spread: 0.0040, swaps: { long: '-2.6', short: '-2.2' }, schedule: 'forex24x5', tags: ['commodities', 'metals'], popularity: 40, source_label: 'Derived from underlying futures' }),

  // ---- large-cap US equities (Twelve Data) ----
  mk({ id: 'share.msft', symbol: 'MSFT', display_symbol: 'MSFT', display_name: 'Microsoft Corp. CFD', description: 'CFD on Microsoft Corp. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 428.42, spread: 0.06, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 86, source_label: 'NASDAQ' }),
  mk({ id: 'share.nvda', symbol: 'NVDA', display_symbol: 'NVDA', display_name: 'NVIDIA Corp. CFD', description: 'CFD on NVIDIA Corp. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 116.24, spread: 0.04, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 90, source_label: 'NASDAQ' }),
  mk({ id: 'share.tsla', symbol: 'TSLA', display_symbol: 'TSLA', display_name: 'Tesla Inc. CFD', description: 'CFD on Tesla Inc. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 248.42, spread: 0.08, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 82, source_label: 'NASDAQ' }),
  mk({ id: 'share.amzn', symbol: 'AMZN', display_symbol: 'AMZN', display_name: 'Amazon.com Inc. CFD', description: 'CFD on Amazon.com Inc. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 184.62, spread: 0.05, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 78, source_label: 'NASDAQ' }),
  mk({ id: 'share.googl', symbol: 'GOOGL', display_symbol: 'GOOGL', display_name: 'Alphabet Inc. CFD', description: 'CFD on Alphabet Inc. (Class A) shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 178.24, spread: 0.05, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 75, source_label: 'NASDAQ' }),
  mk({ id: 'share.meta', symbol: 'META', display_symbol: 'META', display_name: 'Meta Platforms Inc. CFD', description: 'CFD on Meta Platforms Inc. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 564.42, spread: 0.10, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 73, source_label: 'NASDAQ' }),
  mk({ id: 'share.nflx', symbol: 'NFLX', display_symbol: 'NFLX', display_name: 'Netflix Inc. CFD', description: 'CFD on Netflix Inc. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 712.42, spread: 0.14, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 64, source_label: 'NASDAQ' }),
  mk({ id: 'share.amd', symbol: 'AMD', display_symbol: 'AMD', display_name: 'Advanced Micro Devices CFD', description: 'CFD on Advanced Micro Devices Inc. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 158.42, spread: 0.05, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 66, source_label: 'NASDAQ' }),
  mk({ id: 'share.intc', symbol: 'INTC', display_symbol: 'INTC', display_name: 'Intel Corp. CFD', description: 'CFD on Intel Corp. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 31.42, spread: 0.03, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'tech', 'us'], popularity: 52, source_label: 'NASDAQ' }),
  mk({ id: 'share.jpm', symbol: 'JPM', display_symbol: 'JPM', display_name: 'JPMorgan Chase & Co. CFD', description: 'CFD on JPMorgan Chase & Co. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 204.42, spread: 0.05, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'financials', 'us'], popularity: 60, source_label: 'NYSE' }),
  mk({ id: 'share.v', symbol: 'V', display_symbol: 'V', display_name: 'Visa Inc. CFD', description: 'CFD on Visa Inc. shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 284.42, spread: 0.06, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'financials', 'us'], popularity: 57, source_label: 'NYSE' }),
  mk({ id: 'share.ko', symbol: 'KO', display_symbol: 'KO', display_name: 'Coca-Cola Co. CFD', description: 'CFD on The Coca-Cola Company shares', asset_class: 'shares', category: 'cash', digits: 2, contract_size: '1', base_currency: 'USD', profit_currency: 'USD', margin_currency: 'USD', bid: 62.42, spread: 0.03, swaps: { long: '-0.0250', short: '-0.0150', type: 'percent', triple_swap_day: 'fri' }, schedule: 'usEquity', tags: ['shares', 'consumer', 'us'], popularity: 50, source_label: 'NYSE' }),
];
