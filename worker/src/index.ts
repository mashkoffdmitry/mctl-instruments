// Cloudflare Worker that edge-caches the public instrument catalog from an R2
// bucket. Optional layer: the proxy still serves /v1/public/instruments itself
// when the worker isn't deployed. Mirrors the proven pelican worker shape.
//
//   GET  /v1/public/instruments   → full catalog snapshot from R2 (no filters)
//   GET  /healthz                 → liveness
//   POST /__ingest                → proxy pushes a fresh snapshot (X-Ingest-Secret)
//
// R2 stores RAW JSON (not gzip): Cloudflare's edge auto-compresses on egress,
// so storing gzip would double-compress. Filtered/personalized queries are not
// cached here — clients send those straight to the origin proxy.

export interface Env {
  CATALOG: R2Bucket;
  INGEST_SECRET: string;
}

const KEY = 'catalog-latest.json';

function json(body: unknown, status = 200, maxAge = 0): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  headers['cache-control'] = maxAge > 0 ? `public, max-age=${maxAge}, s-maxage=${maxAge}` : 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/__ingest') {
      if ((req.headers.get('x-ingest-secret') ?? '') !== env.INGEST_SECRET) {
        return json({ error: 'forbidden' }, 403);
      }
      const text = await req.text();
      try {
        JSON.parse(text); // validate
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      await env.CATALOG.put(KEY, text, { httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=300' } });
      return json({ ok: true, bytes: text.length });
    }

    if (url.pathname === '/healthz') return json({ status: 'ok' });

    if (req.method === 'GET' && url.pathname === '/v1/public/instruments' && url.search === '') {
      const obj = await env.CATALOG.get(KEY);
      if (!obj) return json({ error: 'catalog not built yet' }, 503, 30);
      return new Response(obj.body, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' },
      });
    }

    return json({ error: 'not found' }, 404);
  },
};
