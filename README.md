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

## Deploy

Built centrally by mctl on push to `main` (see `.github/workflows/ci.yml`) →
`ghcr.io/mctlhq/mctl-instruments:<tag>` → `labs` tenant service `instruments-proxy`.
Tags carry **no** `v` prefix.
