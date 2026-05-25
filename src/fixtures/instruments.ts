import type { InstrumentRecord } from '../domain/types.ts';

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
  record: Omit<InstrumentRecord, 'freshness' | 'quote' | 'schedule'> & {
    quote: Omit<InstrumentRecord['quote'], 'last_quote_at'>;
    schedule: Omit<InstrumentRecord['schedule'], 'next_open_at' | 'next_close_at' | 'schedule_updated_at'>;
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
];
