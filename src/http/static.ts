import type { ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, normalize, extname } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

// Serve a static SPA from `rootDir`. `rel` is the request path relative to the
// mount point (already stripped of the prefix). Falls back to index.html so the
// SPA route resolves. Returns false when the asset cannot be served.
export async function serveStatic(
  res: ServerResponse,
  rootDir: string,
  rel: string,
): Promise<boolean> {
  const cleaned = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
  const isAsset = cleaned.includes('/') || /\.[a-z0-9]+$/i.test(cleaned);
  const target = isAsset ? resolve(rootDir, cleaned) : resolve(rootDir, 'index.html');

  // Path-traversal guard: resolved file must stay within rootDir.
  if (target !== rootDir && !target.startsWith(rootDir + '/')) return false;

  let data: Buffer;
  try {
    data = await readFile(target);
  } catch {
    // Asset miss → SPA fallback to index.html.
    try {
      data = await readFile(resolve(rootDir, 'index.html'));
    } catch {
      return false;
    }
  }
  const ext = extname(target) || '.html';
  const isHashed = /\.[0-9a-z_-]{8,}\.(js|css|woff2)$/i.test(target);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    'content-length': String(data.length),
  });
  res.end(data);
  return true;
}
