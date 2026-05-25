// Wire types consumed from the mctl-instruments /v1 API (client-side view).

export type TradingStatus = 'enabled' | 'close_only' | 'disabled' | 'halt' | 'break';
export type SessionState = 'open' | 'closed' | 'holiday' | 'break';
export type QuoteMode = 'real_time' | 'delayed' | 'indicative';

// Derived UI state used to drive badges/CTA — superset of the raw fields.
export type UiState =
  | 'open_realtime'
  | 'open_delayed'
  | 'close_only'
  | 'market_closed'
  | 'holiday_modified'
  | 'halt_or_break'
  | 'stale_data';

export interface StatusBlock {
  trading_status: TradingStatus;
  session_state: SessionState;
  status_reason_code: string | null;
}

export interface QuoteBlock {
  bid: string;
  ask: string;
  mid: string;
  current_spread_pips: string;
  spread_type?: string;
  quote_mode: QuoteMode;
  delay_seconds: number;
  last_quote_at: string;
}

export interface CatalogRow {
  instrument_id: string;
  symbol: string;
  display_symbol: string;
  display_name: string;
  asset_class: string;
  category: string;
  tags: string[];
  status: StatusBlock;
  quote?: QuoteBlock;
  margin_summary?: { margin_model: string; margin_rate_from: string; max_leverage_from: string };
  volume_summary: { min_volume: string; volume_step: string };
  schedule_summary: { next_close_at: string | null; display_timezone: string };
}

export interface InstrumentDetail {
  instrument_id: string;
  symbol: string;
  display_symbol: string;
  display_name: string;
  description: string;
  asset_class: string;
  category: string;
  price_source: { market_model: string; source_label: string; quote_mode: QuoteMode; delay_seconds: number };
  currencies: { base_currency: string; profit_currency: string; margin_currency: string };
  spec: { contract_size: string; digits: number; tick_size: string; tick_value: string; measurement_unit: string };
  trading_conditions: {
    min_volume: string;
    max_volume: string;
    volume_step: string;
    pricing_model: string;
    spread_type: string;
    typical_spread: { value_pips: string; methodology_label: string; period_label: string };
    commission: { amount: string; currency: string; basis: string };
    swaps: { swap_type: string; long: string; short: string; triple_swap_day: string };
  };
  margin: {
    margin_model: string;
    margin_rate_from: string;
    max_leverage_from: string;
    tiers: { up_to_notional?: string; up_to_volume?: string; margin_rate: string; max_leverage: string }[];
  };
  schedule: SchedulePayload;
  lifecycle: { expiry_or_rollover_date: string | null };
  tags: string[];
  freshness: { config_updated_at: string; quote_updated_at: string; schedule_updated_at: string };
  disclosures: { spread: string; financing: string };
}

export interface SchedulePayload {
  schedule_timezone: string;
  regular_intervals: { day: string; open: string; close: string }[];
  holiday_exceptions: { name: string; date: string; is_closed: boolean; early_close?: string; reopen?: string }[];
  next_open_at: string | null;
  next_close_at: string | null;
  display_timezone?: string;
}

export interface MarketState {
  instrument_id: string;
  trading_status: TradingStatus;
  session_state: SessionState;
  status_reason_code: string | null;
  permissions: { can_open: boolean; can_close: boolean; can_modify_pending: boolean; can_modify_protection: boolean };
  quote: QuoteBlock;
  session: { next_open_at: string | null; next_close_at: string | null; display_timezone: string };
}

export interface FilterReference {
  asset_classes: { id: string; label: string; sorting_order: number }[];
  categories: { id: string; asset_class: string; label: string }[];
  statuses: { id: TradingStatus; label: string }[];
  quote_modes: { id: QuoteMode; label: string }[];
  tags: { id: string; label: string }[];
}

export interface Envelope<T> {
  data: T;
  meta: Record<string, unknown> & { next_cursor?: string | null };
}
