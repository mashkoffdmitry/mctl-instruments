import type {
  CatalogRow,
  Envelope,
  FilterReference,
  InstrumentDetail,
  MarketState,
  SchedulePayload,
} from '../types.ts';

export interface CatalogParams {
  search?: string;
  asset_class?: string;
  category?: string;
  status?: string;
  tradable_now?: boolean;
  account_type?: string;
  platform?: string;
  limit?: number;
  cursor?: string;
  sort?: string;
  tz?: string;
  locale?: string;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: string, locale: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept-Language': locale } });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string; title?: string };
      detail = body.detail ?? body.title ?? detail;
    } catch {
      /* ignore parse error */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export function createApi(apiBase: string, locale: string) {
  const base = apiBase.replace(/\/$/, '');
  return {
    async listCatalog(params: CatalogParams): Promise<Envelope<CatalogRow[]>> {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
      return getJson<Envelope<CatalogRow[]>>(`${base}/v1/public/instruments?${qs.toString()}`, locale);
    },
    getDetail(id: string, tz: string, dims: { account_type?: string; platform?: string } = {}): Promise<Envelope<InstrumentDetail>> {
      const qs = new URLSearchParams({ tz, locale });
      if (dims.account_type) qs.set('account_type', dims.account_type);
      if (dims.platform) qs.set('platform', dims.platform);
      return getJson<Envelope<InstrumentDetail>>(
        `${base}/v1/public/instruments/${encodeURIComponent(id)}?${qs.toString()}`,
        locale,
      );
    },
    getMarketState(id: string, tz: string): Promise<Envelope<MarketState>> {
      const qs = new URLSearchParams({ tz });
      return getJson<Envelope<MarketState>>(
        `${base}/v1/public/instruments/${encodeURIComponent(id)}/market-state?${qs.toString()}`,
        locale,
      );
    },
    getSchedule(id: string, tz: string): Promise<Envelope<SchedulePayload>> {
      const qs = new URLSearchParams({ tz });
      return getJson<Envelope<SchedulePayload>>(
        `${base}/v1/public/instruments/${encodeURIComponent(id)}/schedule?${qs.toString()}`,
        locale,
      );
    },
    getFilters(): Promise<Envelope<FilterReference>> {
      return getJson<Envelope<FilterReference>>(`${base}/v1/public/reference/filters`, locale);
    },
  };
}

export type Api = ReturnType<typeof createApi>;
