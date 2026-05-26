import type { InstrumentRecord } from '../domain/types.ts';

export interface IncludeSet {
  quote: boolean;
  margin_summary: boolean;
}

export function catalogRow(rec: InstrumentRecord, include: IncludeSet, displayTz: string) {
  const row: Record<string, unknown> = {
    instrument_id: rec.instrument_id,
    symbol: rec.symbol,
    display_symbol: rec.display_symbol,
    display_name: rec.display_name,
    asset_class: rec.asset_class,
    category: rec.category,
    tags: rec.tags,
    status: {
      trading_status: rec.state.trading_status,
      session_state: rec.state.session_state,
      status_reason_code: rec.state.status_reason_code,
    },
    volume_summary: {
      min_volume: rec.trading_conditions.min_volume,
      max_volume: rec.trading_conditions.max_volume,
      volume_step: rec.trading_conditions.volume_step,
    },
    contract_size: rec.spec.contract_size,
    costs_summary: {
      commission: rec.trading_conditions.commission.amount,
      commission_currency: rec.trading_conditions.commission.currency,
      swap_long: rec.trading_conditions.swaps.long,
      swap_short: rec.trading_conditions.swaps.short,
    },
    schedule_summary: { next_close_at: rec.schedule.next_close_at, display_timezone: displayTz },
  };
  if (include.quote) {
    row.quote = {
      bid: rec.quote.bid,
      ask: rec.quote.ask,
      mid: rec.quote.mid,
      current_spread_pips: rec.quote.current_spread_pips,
      spread_type: rec.quote.spread_type,
      quote_mode: rec.quote.quote_mode,
      delay_seconds: rec.quote.delay_seconds,
      last_quote_at: rec.quote.last_quote_at,
    };
  }
  if (include.margin_summary) {
    row.margin_summary = {
      margin_model: rec.margin.margin_model,
      margin_rate_from: rec.margin.margin_rate_from,
      max_leverage_from: rec.margin.max_leverage_from,
    };
  }
  return row;
}

export function detail(rec: InstrumentRecord) {
  return {
    instrument_id: rec.instrument_id,
    symbol: rec.symbol,
    display_symbol: rec.display_symbol,
    display_name: rec.display_name,
    description: rec.description,
    asset_class: rec.asset_class,
    category: rec.category,
    price_source: rec.price_source,
    currencies: rec.currencies,
    spec: rec.spec,
    trading_conditions: rec.trading_conditions,
    margin: rec.margin,
    execution: rec.execution,
    schedule: rec.schedule,
    lifecycle: { expiry_or_rollover_date: rec.expiry_or_rollover_date },
    tags: rec.tags,
    account_type: rec.account_type ?? null,
    platform: rec.platform ?? null,
    freshness: rec.freshness,
    disclosures: rec.disclosures,
  };
}

export function marketState(rec: InstrumentRecord, displayTz: string) {
  return {
    instrument_id: rec.instrument_id,
    trading_status: rec.state.trading_status,
    session_state: rec.state.session_state,
    status_reason_code: rec.state.status_reason_code,
    permissions: rec.permissions,
    quote: {
      bid: rec.quote.bid,
      ask: rec.quote.ask,
      mid: rec.quote.mid,
      current_spread_pips: rec.quote.current_spread_pips,
      quote_mode: rec.quote.quote_mode,
      delay_seconds: rec.quote.delay_seconds,
      last_quote_at: rec.quote.last_quote_at,
    },
    session: {
      next_open_at: rec.schedule.next_open_at,
      next_close_at: rec.schedule.next_close_at,
      display_timezone: displayTz,
    },
  };
}

export function schedule(rec: InstrumentRecord, displayTz: string) {
  return {
    instrument_id: rec.instrument_id,
    schedule_timezone: rec.schedule.schedule_timezone,
    regular_intervals: rec.schedule.regular_intervals,
    holiday_exceptions: rec.schedule.holiday_exceptions,
    next_open_at: rec.schedule.next_open_at,
    next_close_at: rec.schedule.next_close_at,
    display_timezone: displayTz,
  };
}
