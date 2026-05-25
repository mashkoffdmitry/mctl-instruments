import type { Provider } from '../provider/provider.ts';
import type { BinanceClient } from '../provider/binance.ts';

// Minimal in-process counters + a Prometheus text renderer. Per-layer freshness
// gauges are computed at scrape time from the live provider snapshot.
export class Metrics {
  private requestsByClass = new Map<string, number>();
  private rateLimited = 0;
  private errors = 0;

  recordRequest(status: number): void {
    const cls = `${Math.floor(status / 100)}xx`;
    this.requestsByClass.set(cls, (this.requestsByClass.get(cls) ?? 0) + 1);
    if (status >= 500) this.errors += 1;
  }
  recordRateLimited(): void {
    this.rateLimited += 1;
  }

  async render(opts: {
    version: string;
    provider: Provider;
    binance: BinanceClient | null;
    nowMs: number;
  }): Promise<string> {
    const { version, provider, binance, nowMs } = opts;
    const lines: string[] = [];
    const g = (name: string, help: string, type: 'gauge' | 'counter') => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
    };

    g('mctl_instruments_build_info', 'Build info.', 'gauge');
    lines.push(`mctl_instruments_build_info{version="${version}"} 1`);

    g('mctl_instruments_http_requests_total', 'HTTP responses by status class.', 'counter');
    for (const [cls, n] of this.requestsByClass) lines.push(`mctl_instruments_http_requests_total{class="${cls}"} ${n}`);

    g('mctl_instruments_rate_limited_total', 'Requests rejected with 429.', 'counter');
    lines.push(`mctl_instruments_rate_limited_total ${this.rateLimited}`);

    g('mctl_instruments_server_errors_total', '5xx responses.', 'counter');
    lines.push(`mctl_instruments_server_errors_total ${this.errors}`);

    if (binance) {
      const st = binance.status();
      g('mctl_instruments_upstream_up', 'Upstream feed healthy (1) or erroring (0).', 'gauge');
      lines.push(`mctl_instruments_upstream_up ${st.last_error === null ? 1 : 0}`);
      g('mctl_instruments_upstream_cached_symbols', 'Symbols with a cached upstream quote.', 'gauge');
      lines.push(`mctl_instruments_upstream_cached_symbols ${st.cached}`);
    }

    // Per-instrument freshness + tradability snapshot.
    const page = await provider.listCatalog({ limit: 500 });
    g('mctl_instruments_quote_age_seconds', 'Seconds since the last quote update.', 'gauge');
    for (const rec of page.items) {
      const age = Math.max(0, (nowMs - Date.parse(rec.quote.last_quote_at)) / 1000);
      lines.push(`mctl_instruments_quote_age_seconds{instrument_id="${rec.instrument_id}",quote_mode="${rec.quote.quote_mode}"} ${age.toFixed(1)}`);
    }
    g('mctl_instruments_schedule_age_seconds', 'Seconds since the schedule snapshot.', 'gauge');
    for (const rec of page.items) {
      const age = Math.max(0, (nowMs - Date.parse(rec.freshness.schedule_updated_at)) / 1000);
      lines.push(`mctl_instruments_schedule_age_seconds{instrument_id="${rec.instrument_id}"} ${age.toFixed(0)}`);
    }
    g('mctl_instruments_tradable', 'Instrument is tradable now (enabled + session open).', 'gauge');
    for (const rec of page.items) {
      const tradable = rec.state.trading_status === 'enabled' && rec.state.session_state === 'open' ? 1 : 0;
      lines.push(`mctl_instruments_tradable{instrument_id="${rec.instrument_id}"} ${tradable}`);
    }
    // Data-integrity signal: enabled but cannot derive a sane quote (ask<bid / spread<=0).
    g('mctl_instruments_quote_integrity_bad', 'Quote integrity violation (ask<bid or spread<=0) on a tradable instrument.', 'gauge');
    let bad = 0;
    for (const rec of page.items) {
      const spread = Number(rec.quote.current_spread_pips);
      const inverted = Number(rec.quote.ask) < Number(rec.quote.bid);
      if (rec.state.trading_status === 'enabled' && rec.state.session_state === 'open' && (inverted || spread < 0)) bad += 1;
    }
    lines.push(`mctl_instruments_quote_integrity_bad ${bad}`);

    return lines.join('\n') + '\n';
  }
}
