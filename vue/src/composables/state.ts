import type { QuoteBlock, StatusBlock, UiState } from '../types.ts';

// Threshold (seconds) past which an "open" instrument's quote is considered stale.
const STALE_OPEN_SECONDS = 60;

// `detectStale` is only meaningful for the live market-state (no-store, polled).
// Catalog rows come from a cacheable snapshot (max-age), so a few minutes of
// wall-clock age is expected and must NOT be rendered as "stale".
export function deriveUiState(
  status: StatusBlock,
  quote: QuoteBlock | undefined,
  nowMs: number,
  detectStale = true,
): UiState {
  if (status.trading_status === 'halt' || status.trading_status === 'break') return 'halt_or_break';
  if (status.session_state === 'holiday') return 'holiday_modified';
  if (status.session_state === 'closed') return 'market_closed';
  if (status.trading_status === 'close_only') return 'close_only';

  // Open: distinguish real-time / delayed / stale.
  if (quote) {
    if (detectStale && status.session_state === 'open' && quote.quote_mode === 'real_time') {
      const ageSec = (nowMs - Date.parse(quote.last_quote_at)) / 1000;
      if (ageSec > STALE_OPEN_SECONDS) return 'stale_data';
    }
    if (quote.quote_mode === 'delayed' || quote.quote_mode === 'indicative') return 'open_delayed';
  }
  return 'open_realtime';
}

export const STATE_TONE: Record<UiState, 'ok' | 'info' | 'warn' | 'danger' | 'muted'> = {
  open_realtime: 'ok',
  open_delayed: 'info',
  close_only: 'warn',
  market_closed: 'muted',
  holiday_modified: 'warn',
  halt_or_break: 'danger',
  stale_data: 'danger',
};
