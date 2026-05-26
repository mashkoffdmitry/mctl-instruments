import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { serveStatic } from './http/static.ts';
import { FixtureProvider } from './provider/fixture-provider.ts';
import { CompositeProvider } from './provider/composite.ts';
import { BinanceClient } from './provider/binance.ts';
import type { Provider } from './provider/provider.ts';
import { HttpProblem, badRequest, notFound, tooManyRequests, unauthorized } from './http/problem.ts';
import { sendJson, sendProblem, type CachePolicy } from './http/response.ts';
import { RateLimiter } from './http/ratelimit.ts';
import { Metrics } from './http/metrics.ts';
import { parseCatalogQuery, parseInclude, parseDimensions } from './routes/parse.ts';
import * as serialize from './routes/serialize.ts';

const PORT = Number(process.env.PORT ?? 8787);
const ANON_RATE = Number(process.env.RATE_LIMIT ?? 120); // req/min/IP
const TOKEN_RATE = Number(process.env.PRIVATE_RATE_LIMIT ?? 600); // req/min/token
const SERVICE_VERSION = process.env.SERVICE_VERSION ?? '0.4.0';
const STARTED_AT = new Date().toISOString();

// Static demo SPA lives at <repo>/public/demo (baked into the image).
// From dist/server.js that resolves to ../public/demo.
const DEMO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo');

const UPSTREAM_BINANCE = (process.env.UPSTREAM_BINANCE ?? 'true') !== 'false';
const binance = new BinanceClient();
const fixtureProvider = new FixtureProvider();
const provider: Provider = UPSTREAM_BINANCE ? new CompositeProvider(fixtureProvider, binance) : fixtureProvider;
if (UPSTREAM_BINANCE) binance.start();

// Optional: periodically push the full public catalog to the edge worker (R2).
// No-op unless both env vars are set (the worker layer is optional).
const CATALOG_INGEST_URL = process.env.CATALOG_INGEST_URL ?? '';
const CATALOG_INGEST_SECRET = process.env.CATALOG_INGEST_SECRET ?? '';
const CATALOG_PUSH_MS = Number(process.env.CATALOG_PUSH_MS ?? 300_000);

async function pushCatalogToEdge(): Promise<void> {
  if (!CATALOG_INGEST_URL || !CATALOG_INGEST_SECRET) return;
  try {
    const page = await provider.listCatalog({ limit: 500 });
    const data = page.items.map((rec) => serialize.catalogRow(rec, { quote: true, margin_summary: true }, 'UTC'));
    const body = JSON.stringify({ data, meta: { generated_at: rfc3339Now(), next_cursor: null } });
    await fetch(CATALOG_INGEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-secret': CATALOG_INGEST_SECRET },
      body,
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('catalog edge push failed:', (e as Error).message);
  }
}
if (CATALOG_INGEST_URL && CATALOG_INGEST_SECRET) {
  void pushCatalogToEdge();
  setInterval(() => void pushCatalogToEdge(), CATALOG_PUSH_MS).unref();
}

const metrics = new Metrics();
const anonLimiter = new RateLimiter(ANON_RATE, 60_000);
const tokenLimiter = new RateLimiter(TOKEN_RATE, 60_000);
setInterval(() => {
  anonLimiter.sweep();
  tokenLimiter.sweep();
}, 60_000).unref();

function rfc3339Now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}

function bearerToken(req: IncomingMessage): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1]!.trim() : null;
}

function meta(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { generated_at: rfc3339Now(), request_id: `req_${randomUUID()}`, ...extra };
}

function displayTz(params: URLSearchParams): string {
  return params.get('tz') ?? 'UTC';
}

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: URLSearchParams;
  traceId: string;
}

async function handle(ctx: Ctx): Promise<void> {
  const { req, res, url, params, traceId } = ctx;
  const path = url.pathname;

  if (req.method !== 'GET') throw badRequest('Поддерживается только метод GET.');

  // ---- demo SPA ----
  if (path === '/demo' || path.startsWith('/demo/')) {
    const rel = path.slice('/demo'.length).replace(/^\//, '');
    const served = await serveStatic(res, DEMO_DIR, rel);
    if (!served) throw notFound('Демо недоступно.');
    return;
  }

  // ---- ops endpoints ----
  if (path === '/healthz') {
    sendJson(req, res, { status: 200, body: { status: 'ok' }, cache: { kind: 'no-store' } });
    return;
  }
  if (path === '/readyz') {
    sendJson(req, res, { status: 200, body: { status: 'ready', version: SERVICE_VERSION }, cache: { kind: 'no-store' } });
    return;
  }
  if (path === '/metrics') {
    const text = await metrics.render({ version: SERVICE_VERSION, provider, binance: UPSTREAM_BINANCE ? binance : null, nowMs: Date.now() });
    res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' });
    res.end(text);
    return;
  }

  if (path === '/__status') {
    sendJson(req, res, {
      status: 200,
      body: {
        service: 'mctl-instruments',
        version: SERVICE_VERSION,
        started_at: STARTED_AT,
        provider: UPSTREAM_BINANCE ? 'composite(fixture+binance)' : 'fixture',
        upstream: UPSTREAM_BINANCE ? binance.status() : null,
      },
      cache: { kind: 'no-store' },
    });
    return;
  }

  // Browsers hitting the root get the demo UI; API clients get the JSON index.
  if (path === '/' && (req.headers['accept'] ?? '').includes('text/html')) {
    res.writeHead(302, { location: '/demo/', 'cache-control': 'no-store' });
    res.end();
    return;
  }

  // Friendly API index at the root so a browser visit isn't a bare 404.
  if (path === '/' || path === '/v1') {
    sendJson(req, res, {
      status: 200,
      body: {
        service: 'mctl-instruments',
        version: SERVICE_VERSION,
        description: 'Broker instrument catalog & card API (forex / CFD / crypto).',
        endpoints: {
          catalog: '/v1/public/instruments',
          detail: '/v1/public/instruments/{id}',
          market_state: '/v1/public/instruments/{id}/market-state',
          schedule: '/v1/public/instruments/{id}/schedule',
          reference_filters: '/v1/public/reference/filters',
          account_conditions: '/v1/private/instruments/{id}/account-conditions (Bearer)',
          health: '/healthz',
        },
        docs: 'https://github.com/mashkoffdmitry/mctl-instruments#endpoints',
      },
      cache: { kind: 'short', maxAge: 300 },
      enableEtag: true,
    });
    return;
  }

  // ---- reference filters ----
  if (path === '/v1/public/reference/filters') {
    const data = provider.getFilterReference();
    sendJson(req, res, {
      status: 200,
      body: { data, meta: meta({ locale: params.get('locale') ?? 'en-US' }) },
      cache: { kind: 'static', maxAge: 3600 },
      vary: ['Accept-Language'],
      enableEtag: true,
      etagBasis: data,
    });
    return;
  }

  // ---- catalog list ----
  if (path === '/v1/public/instruments') {
    const query = parseCatalogQuery(params);
    const include = parseInclude(params);
    const tz = displayTz(params);
    const page = await provider.listCatalog(query);
    const data = page.items.map((rec) => serialize.catalogRow(rec, include, tz));
    sendJson(req, res, {
      status: 200,
      body: { data, meta: meta({ next_cursor: page.next_cursor, limit: query.limit }) },
      cache: { kind: 'short', maxAge: 300 },
      vary: ['Accept-Language'],
      enableEtag: true,
      etagBasis: { data, next_cursor: page.next_cursor },
    });
    return;
  }

  // ---- /v1/public/instruments/{id}[/...] ----
  const pub = /^\/v1\/public\/instruments\/([^/]+)(\/market-state|\/schedule)?$/.exec(path);
  if (pub) {
    const id = decodeURIComponent(pub[1]!);
    const sub = pub[2];
    const rec = await provider.getInstrument(id, parseDimensions(params));
    if (!rec) throw notFound(`Инструмент ${id} не найден.`);
    const tz = displayTz(params);

    if (sub === '/market-state') {
      sendJson(req, res, {
        status: 200,
        body: { data: serialize.marketState(rec, tz), meta: meta() },
        cache: { kind: 'no-store' },
      });
      return;
    }
    if (sub === '/schedule') {
      const data = serialize.schedule(rec, tz);
      sendJson(req, res, {
        status: 200,
        body: { data, meta: meta() },
        cache: { kind: 'static', maxAge: 900 },
        enableEtag: true,
        etagBasis: data,
      });
      return;
    }
    // detail
    const data = serialize.detail(rec);
    sendJson(req, res, {
      status: 200,
      body: { data, meta: meta({ locale: params.get('locale') ?? 'en-US', display_timezone: tz }) },
      cache: { kind: 'short', maxAge: 300 },
      vary: ['Accept-Language'],
      enableEtag: true,
      // Exclude volatile freshness timestamps; substantive content (spec, conditions,
      // margin, schedule instants) is what drives the validator.
      etagBasis: { ...data, freshness: null },
    });
    return;
  }

  // ---- private account-conditions ----
  const priv = /^\/v1\/private\/instruments\/([^/]+)\/account-conditions$/.exec(path);
  if (priv) {
    const token = bearerToken(req);
    if (!token) throw unauthorized();
    const retry = tokenLimiter.check(`tok:${token}`);
    if (retry !== null) {
      metrics.recordRateLimited();
      throw tooManyRequests(retry);
    }
    const id = decodeURIComponent(priv[1]!);
    const conditions = await provider.getAccountConditions(id, token);
    if (!conditions) throw notFound(`Инструмент ${id} не найден.`);
    sendJson(req, res, {
      status: 200,
      body: { data: conditions, meta: meta() },
      cache: { kind: 'private' },
      vary: ['Authorization', 'Accept-Language'],
    });
    return;
  }

  throw notFound(`Маршрут ${path} не найден.`);
}

const server = createServer((req, res) => {
  const traceId = `trc_${randomUUID()}`;
  res.on('finish', () => metrics.recordRequest(res.statusCode));
  let url: URL;
  try {
    url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  } catch {
    sendProblem(res, badRequest('Некорректный URL.'), req.url ?? '/', traceId);
    return;
  }

  // Anonymous rate limit (private routes additionally check the token bucket).
  const retry = anonLimiter.check(`ip:${clientIp(req)}`);
  if (retry !== null) {
    metrics.recordRateLimited();
    sendProblem(res, tooManyRequests(retry), url.pathname + url.search, traceId);
    return;
  }

  const ctx: Ctx = { req, res, url, params: url.searchParams, traceId };
  handle(ctx).catch((err: unknown) => {
    const instance = url.pathname + url.search;
    if (err instanceof HttpProblem) {
      sendProblem(res, err, instance, traceId);
      return;
    }
    console.error(`[${traceId}] unhandled error:`, err);
    sendProblem(
      res,
      new HttpProblem({ status: 500, slug: 'internal', title: 'Внутренняя ошибка сервера' }),
      instance,
      traceId,
    );
  });
});

server.listen(PORT, () => {
  console.log(`mctl-instruments ${SERVICE_VERSION} listening on :${PORT} (anon ${ANON_RATE}/min, token ${TOKEN_RATE}/min)`);
});
