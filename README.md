# Solana Prediction Market Aggregator

One market. Multiple venues. Smarter execution.

This repository is being built in stages. Step 1 (foundation and architecture) is complete; Step 2 adds read-only public market data from one venue. No trading integration is configured. Dashboard summary metrics and charts remain clearly labeled demo data.

## Architecture

- `apps/web`: Next.js App Router, React, TypeScript, Tailwind, TanStack Query, Solana Wallet Adapter.
- `apps/api`: NestJS REST and WebSocket API, validation, configuration, structured logging, health endpoint.
- `packages/database`: Prisma schema and migration tooling for PostgreSQL.
- `programs`: reserved for future Anchor programs; no on-chain trading code is included in Step 1.
- `apps/api/src/markets`: Polymarket read-only adapter, normalized market API, price history, order book reads, cache, and cautious canonical-market comparison utility.

## Requirements and setup

Node.js 20+, pnpm 9+, Docker Desktop (for local PostgreSQL/Redis). Copy `.env.example` to `.env` for Docker Compose and the API. Copy `packages/database/.env.example` to `packages/database/.env` for Prisma CLI commands. Adjust local values as needed. Never put secrets in source control.

```sh
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Use `pnpm build` followed by `pnpm start` to run the production builds. The API process can start without the backing services; `/api/v1/health/ready` reports whether PostgreSQL and Redis are reachable.

Web: http://localhost:3000. API liveness: http://localhost:4000/api/v1/health. Storage readiness: http://localhost:4000/api/v1/health/ready. Swagger: http://localhost:4000/api/docs. WebSocket gateway: `/events` (connection establishment only; no venue feed is claimed).

## Environment

See `.env.example`. The frontend defaults to `NEXT_PUBLIC_DATA_MODE=mock`. This flag selects isolated display data and does not configure production services. The API requires `DATABASE_URL`, `REDIS_URL`, `API_PORT`, and `WEB_ORIGIN`. Solana cluster defaults to devnet. No credentials, endpoints, or program addresses are supplied.

## Stage boundary

## Step 2 market data

The first venue adapter is read-only Polymarket public data and implements the shared `MarketVenueAdapter` contract. It uses the documented Gamma keyset event endpoint for market discovery, the CLOB batch books endpoint for public bid/ask depth, the market WebSocket for live book updates where the Node runtime supports WebSocket, and the documented public price-history endpoint. If the stream is unavailable, the UI identifies the scheduled REST update mode. The adapter is intentionally limited to one venue; no Kalshi or Solana-native venue is represented as integrated. See [Polymarket market discovery docs](https://docs.polymarket.com/market-data/discover-markets), [prices, order books, and history docs](https://docs.polymarket.com/market-data/prices-order-books), and [real-time data docs](https://docs.polymarket.com/market-data/realtime-data).

API routes: `GET /api/v1/markets?q=&category=&venue=&includeClosed=`, `GET /api/v1/markets/polymarket/:id`, and `GET /api/v1/markets/polymarket/:id/history?outcome=0&interval=1d`. The adapter refreshes every 60 seconds, scans up to three 100-event keyset pages per sync, retains recently observed pages for 30 minutes in a bounded 10,000-market process cache, retries transient errors with bounded backoff, and caches order books and history. This is a rolling discovery window, not a claim that every venue market has been indexed. Market records carry source venue, observed time, source update time, expiration, outcome IDs and prices, and null for unavailable numeric values. A failed refresh retains the previous dataset and reports the error in the API response. This cache is per API process; Redis-backed shared caching and durable price-history storage remain incomplete.

`NEXT_PUBLIC_DATA_MODE=live` is the default and uses the backend API. Set it to `mock` only to show the isolated synthetic card list. Live market cards identify Polymarket, show freshness and available volume/liquidity, and link to an internal detail page plus original source. The homepage's summary metrics, static dashboard chart, and sample opportunity cards remain demo-only. The canonical comparison helper requires structured outcome, resolution, expiration, and settlement information before returning an equivalence label; with one connected venue there are no cross-venue equivalent pairs or arbitrage claims.

Explore and unrelated navigation destinations remain foundation placeholders. Solana Wallet Adapter context is prepared for devnet; wallet connection and all execution remain Step 3. The API uses default-deny auth and role guards for protected endpoints; the public read-only market endpoints explicitly bypass auth. No identity/signature verification provider is configured. PostgreSQL migration has not been applied in this environment; market data is not persisted there. Redis-backed shared caching, scheduled workers, WebSocket venue streams, a second venue, and cross-venue reconciliation remain incomplete.
