import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { HttpProblem, type Problem } from './problem.ts';

export type CachePolicy =
  | { kind: 'static'; maxAge: number } // public, revalidate via ETag
  | { kind: 'short'; maxAge: number } // public, very short TTL
  | { kind: 'no-store' } // dynamic, never store
  | { kind: 'private' }; // personalized, private no-store

interface SendOptions {
  status: number;
  body: unknown;
  cache: CachePolicy;
  vary?: string[];
  enableEtag?: boolean;
  // When set, the ETag is derived from this value instead of the full body.
  // Lets us exclude volatile `meta` (request_id/generated_at) so conditional
  // revalidation works for otherwise-stable representations.
  etagBasis?: unknown;
  extraHeaders?: Record<string, string>;
}

function cacheControl(policy: CachePolicy): string {
  switch (policy.kind) {
    case 'static':
      return `public, max-age=${policy.maxAge}`;
    case 'short':
      return `public, max-age=${policy.maxAge}`;
    case 'no-store':
      return 'no-store';
    case 'private':
      return 'private, no-store';
  }
}

function strongEtag(payload: string): string {
  return `"${createHash('sha1').update(payload).digest('base64url')}"`;
}

export function sendJson(req: IncomingMessage, res: ServerResponse, opts: SendOptions): void {
  const json = JSON.stringify(opts.body);
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl(opts.cache),
    ...opts.extraHeaders,
  };
  if (opts.vary && opts.vary.length > 0) headers['vary'] = opts.vary.join(', ');

  // Conditional revalidation for cacheable representations.
  if (opts.enableEtag) {
    const etag = strongEtag(opts.etagBasis === undefined ? json : JSON.stringify(opts.etagBasis));
    headers['etag'] = etag;
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => t.trim() === etag)) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
  }

  const acceptsGzip = (req.headers['accept-encoding'] ?? '').includes('gzip');
  if (acceptsGzip && Buffer.byteLength(json) > 1024) {
    const gz = gzipSync(json);
    headers['content-encoding'] = 'gzip';
    headers['content-length'] = String(gz.length);
    res.writeHead(opts.status, headers);
    res.end(gz);
    return;
  }

  headers['content-length'] = String(Buffer.byteLength(json));
  res.writeHead(opts.status, headers);
  res.end(json);
}

export function sendProblem(
  res: ServerResponse,
  problem: HttpProblem,
  instance: string,
  traceId: string,
): void {
  const body: Problem = problem.toProblem(instance, traceId);
  const headers: Record<string, string> = {
    'content-type': 'application/problem+json; charset=utf-8',
    'cache-control': 'no-store',
  };
  if (problem.retryAfterSeconds !== undefined) headers['retry-after'] = String(problem.retryAfterSeconds);
  const json = JSON.stringify(body);
  headers['content-length'] = String(Buffer.byteLength(json));
  res.writeHead(problem.status, headers);
  res.end(json);
}
