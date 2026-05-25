// Domain + wire types for the /v1 instrument contract.
// Convention (per ТЗ): all monetary/price/volume decimals are serialized as
// STRINGS to avoid float rounding; all timestamps are RFC 3339 UTC strings.

export type AssetClass =
  | 'forex'
  | 'indices'
  | 'metals'
  | 'commodities'
  | 'shares'
  | 'crypto';

export type Category =
  | 'major'
  | 'minor'
  | 'exotic'
  | 'spot'
  | 'cash'
  | 'futures_based';

// Permission to trade — independent of whether the session is open.
export type TradingStatus = 'enabled' | 'close_only' | 'disabled' | 'halt' | 'break';

// Temporal state of the market session — independent of trading permission.
export type SessionState = 'open' | 'closed' | 'holiday' | 'break';

export type QuoteMode = 'real_time' | 'delayed' | 'indicative';
export type SpreadType = 'fixed' | 'floating';
export type PricingModel = 'spread_only' | 'spread_plus_commission';
export type MarginModel = 'fixed' | 'tiered' | 'dynamic_leverage';
export type MarketModel = 'otc' | 'exchange';
export type CommissionBasis = 'per_lot_round_turn' | 'per_lot_per_side' | 'percent_notional';
export type SwapType = 'points' | 'percent' | 'money';
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface TradingState {
  trading_status: TradingStatus;
  session_state: SessionState;
  status_reason_code: string | null;
}

export interface Permissions {
  can_open: boolean;
  can_close: boolean;
  can_modify_pending: boolean;
  can_modify_protection: boolean;
}

export interface QuoteState {
  bid: string;
  ask: string;
  mid: string;
  current_spread_pips: string;
  spread_type: SpreadType;
  quote_mode: QuoteMode;
  delay_seconds: number;
  last_quote_at: string;
}

export interface PriceSource {
  market_model: MarketModel;
  source_label: string;
  quote_mode: QuoteMode;
  delay_seconds: number;
}

export interface Currencies {
  base_currency: string;
  profit_currency: string;
  margin_currency: string;
}

export interface InstrumentSpec {
  contract_size: string;
  digits: number;
  tick_size: string;
  tick_value: string;
  measurement_unit: string;
}

export interface TypicalSpread {
  value_pips: string;
  methodology_label: string;
  period_label: string;
}

export interface Commission {
  amount: string;
  currency: string;
  basis: CommissionBasis;
  minimum_commission?: string;
}

export interface Swaps {
  swap_type: SwapType;
  long: string;
  short: string;
  triple_swap_day: Weekday;
}

export interface TradingConditions {
  min_volume: string;
  max_volume: string;
  volume_step: string;
  pricing_model: PricingModel;
  spread_type: SpreadType;
  typical_spread: TypicalSpread;
  commission: Commission;
  swaps: Swaps;
}

export interface MarginTier {
  up_to_notional?: string;
  up_to_volume?: string;
  margin_rate: string;
  max_leverage: string;
}

export interface MarginProfile {
  margin_model: MarginModel;
  margin_currency?: string;
  margin_rate_from: string;
  max_leverage_from: string;
  tiers: MarginTier[];
}

export interface SessionInterval {
  day: Weekday;
  open: string; // HH:mm in schedule_timezone
  close: string;
}

export interface HolidayException {
  name: string;
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  early_close?: string;
  reopen?: string;
}

export interface SessionCalendar {
  schedule_timezone: string; // IANA tz
  regular_intervals: SessionInterval[];
  holiday_exceptions: HolidayException[];
  next_open_at: string | null;
  next_close_at: string | null;
}

export interface FreshnessMeta {
  config_updated_at: string;
  quote_updated_at: string;
  schedule_updated_at: string;
}

export interface Disclosures {
  spread: string;
  financing: string;
}

// ---- canonical internal instrument record (provider output) ----
export interface InstrumentRecord {
  instrument_id: string;
  symbol: string;
  display_symbol: string;
  display_name: string;
  description: string;
  asset_class: AssetClass;
  category: Category;
  tags: string[];
  jurisdictions: string[];
  state: TradingState;
  permissions: Permissions;
  quote: QuoteState;
  price_source: PriceSource;
  currencies: Currencies;
  spec: InstrumentSpec;
  trading_conditions: TradingConditions;
  margin: MarginProfile;
  schedule: SessionCalendar;
  expiry_or_rollover_date: string | null;
  freshness: FreshnessMeta;
  disclosures: Disclosures;
  popularity: number;
}

// ---- account-specific overrides (private) ----
export interface AccountConditions {
  instrument_id: string;
  pricing_model: PricingModel;
  commission: Commission;
  margin: {
    margin_model: MarginModel;
    margin_currency: string;
    tiers: MarginTier[];
  };
  entitlements: {
    quote_mode: QuoteMode;
    market_data_fee_required: boolean;
  };
  restrictions: {
    available_in_region: boolean;
    trade_mode_override: TradingStatus;
  };
}
