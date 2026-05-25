# mctl-instruments

Broker **instrument catalog & card** API for forex / CFD / crypto. A dependency-light
Node/TypeScript proxy that serves a layered, domain-separated `/v1` REST contract:

- **Public catalog** — list + filters + cursor pagination
- **Public detail** — full instrument specification, costs, margin, schedule
- **Market state** — lightweight live quote/status snapshot (no caching)
- **Schedule** — structured weekly intervals + holiday exceptions
- **Private account-conditions** — personalized commission/leverage behind a Bearer token

Phase 1 is backed by a **fixture catalog** (`src/fixtures/instruments.ts`) behind a
`Provider` interface (`src/provider/provider.ts`). A real broker adapter swaps in behind the
same interface without touching the routes.

## Run locally

```bash
npm install
npm run dev          # node --watch, runs src/server.ts directly (TS strip-types)
# or
npm run build && npm start
```

Server listens on `PORT` (default `8787`).

## Endpoints

| Method | Path | Cache |
|---|---|---|
| GET | `/v1/public/instruments` | `public, max-age=300` + ETag |
| GET | `/v1/public/instruments/{id}` | `public, max-age=300` + ETag |
| GET | `/v1/public/instruments/{id}/market-state` | `no-store` |
| GET | `/v1/public/instruments/{id}/schedule` | `public, max-age=900` + ETag |
| GET | `/v1/public/reference/filters` | `public, max-age=3600` + ETag |
| GET | `/v1/private/instruments/{id}/account-conditions` | `private, no-store` (Bearer) |
| GET | `/demo/` | static SPA (browser hits on `/` redirect here) |
| GET | `/metrics` | Prometheus text, `no-store` |
| GET | `/healthz`, `/readyz`, `/__status` | `no-store` |

### Catalog query params
`search`, `asset_class`, `category`, `status`, `tradable_now`, `quote_mode`, `tags`
(comma-list), `jurisdiction`, `sort` (`popularity`/`-popularity`/`symbol`/`-symbol`),
`limit` (1–200), `cursor`, `include` (`quote,margin_summary`), `tz`, `locale`.

## Contract conventions

- Decimals serialized as **strings**; timestamps **RFC 3339 UTC**.
- Errors: `application/problem+json` (RFC 9457) with `type/title/status/detail/instance/trace_id`.
- `ETag`/`If-None-Match` on static + semi-static; `Vary: Authorization, Accept-Language`.
- Bearer (RFC 6750) on `/private/*`; private responses never edge-cacheable.
- Rate limits: anon `120/min/IP`, token `600/min`; `429` carries `Retry-After`.

## Data sources

`Provider` (`src/provider/provider.ts`) is the single seam between the API and data:

- **FixtureProvider** — seed catalog across forex/CFD/crypto (`src/fixtures/`).
- **Session engine** (`src/domain/session.ts`) — DST-aware derivation of `session_state`,
  `next_open_at`, `next_close_at` from the schedule calendar + holiday exceptions, in the
  instrument's IANA timezone.
- **CompositeProvider** (`src/provider/composite.ts`) — overlays **live crypto quotes** from
  Binance's public REST API (`src/provider/binance.ts`, no auth) onto crypto instruments,
  falling back to fixtures when the feed is stale/unreachable. FX/indices/shares have no
  licensed public feed wired and pass through as fixtures. Toggle with `UPSTREAM_BINANCE=false`.

## Demo UI

The built Vue widget demo (`vue/`) is baked into the image and served at `/demo/`. Browser
hits on `/` redirect there; API clients on `/` get the JSON index.

## Monitoring

`/metrics` exposes Prometheus gauges/counters. Suggested alert thresholds:

| Signal | Condition | Severity |
|---|---|---|
| `mctl_instruments_quote_age_seconds{quote_mode="real_time"}` | `> 60` while `tradable=1` | warning |
| `mctl_instruments_upstream_up` | `== 0` for > 5 min | warning |
| `mctl_instruments_quote_integrity_bad` | `> 0` | critical |
| `mctl_instruments_server_errors_total` | rate increase | warning |

Scraping a tenant service needs the `allow-ingress-from-monitoring` NetworkPolicy.

## Edge cache (optional)

`worker/` is a Cloudflare Worker that fronts the full public catalog from an R2 bucket
(mirrors the pelican pattern). Deploy is optional and needs CF credentials:
`cd worker && npx wrangler r2 bucket create instruments-catalog && npx wrangler secret put
INGEST_SECRET && npx wrangler deploy`. The proxy pushes snapshots when `CATALOG_INGEST_URL`
+ `CATALOG_INGEST_SECRET` are set (no-op otherwise).

## Deploy

Built centrally by mctl on push to `main` (see `.github/workflows/ci.yml`) →
`ghcr.io/mctlhq/mctl-instruments:<tag>` → `labs` tenant service `instruments-proxy`.
Tags carry **no** `v` prefix.
