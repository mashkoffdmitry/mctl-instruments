import type { AssetClass, Category, QuoteMode, TradingStatus } from '../domain/types.ts';
import type { CatalogQuery } from '../provider/provider.ts';
import type { IncludeSet } from './serialize.ts';
import { badRequest, unprocessable } from '../http/problem.ts';

const ASSET_CLASSES = ['forex', 'indices', 'metals', 'commodities', 'shares', 'crypto'] as const;
const CATEGORIES = ['major', 'minor', 'exotic', 'spot', 'cash', 'futures_based'] as const;
const STATUSES = ['enabled', 'close_only', 'disabled', 'halt', 'break'] as const;
const QUOTE_MODES = ['real_time', 'delayed', 'indicative'] as const;
const SORT_KEYS = ['popularity', '-popularity', 'symbol', '-symbol'] as const;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw unprocessable(`Параметр ${field} должен быть одним из: ${allowed.join(', ')}.`, [
    { pointer: `#/query/${field}`, detail: 'Unknown enum value' },
  ]);
}

export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const q: CatalogQuery = { limit: DEFAULT_LIMIT };

  const search = params.get('search');
  if (search) q.search = search;

  const assetClass = params.get('asset_class');
  if (assetClass) q.asset_class = oneOf<AssetClass>(assetClass, ASSET_CLASSES, 'asset_class');

  const category = params.get('category');
  if (category) q.category = oneOf<Category>(category, CATEGORIES, 'category');

  const status = params.get('status');
  if (status) q.status = oneOf<TradingStatus>(status, STATUSES, 'status');

  const quoteMode = params.get('quote_mode');
  if (quoteMode) q.quote_mode = oneOf<QuoteMode>(quoteMode, QUOTE_MODES, 'quote_mode');

  const tradableNow = params.get('tradable_now');
  if (tradableNow !== null) {
    if (tradableNow !== 'true' && tradableNow !== 'false') {
      throw unprocessable('Параметр tradable_now должен быть true или false.', [
        { pointer: '#/query/tradable_now', detail: 'Expected boolean' },
      ]);
    }
    q.tradable_now = tradableNow === 'true';
  }

  const jurisdiction = params.get('jurisdiction');
  if (jurisdiction) q.jurisdiction = jurisdiction;

  const tags = params.get('tags');
  if (tags) q.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);

  const sort = params.get('sort');
  if (sort) q.sort = oneOf(sort, SORT_KEYS, 'sort');

  const cursor = params.get('cursor');
  if (cursor) q.cursor = cursor;

  const limit = params.get('limit');
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      throw badRequest(`Параметр limit должен быть целым числом от 1 до ${MAX_LIMIT}.`, [
        { pointer: '#/query/limit', detail: 'Out of range' },
      ]);
    }
    q.limit = n;
  }

  return q;
}

export function parseInclude(params: URLSearchParams): IncludeSet {
  const raw = params.get('include');
  if (raw === null) return { quote: true, margin_summary: true };
  const set = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  return { quote: set.has('quote'), margin_summary: set.has('margin_summary') };
}
