# Solana Prediction Market Aggregator

One market. Multiple venues. Smarter execution.

This repository is being built in stages. Steps 1 and 2 provide the foundation and read-only public market data from one venue. Step 3 adds external wallet connection, a server-side read-only Solana RPC proxy, quote simulation, and wallet balance display. No prediction-market order execution is configured. Dashboard summary metrics and charts remain clearly labeled demo data.

## Architecture

- `apps/web`: Next.js App Router, React, TypeScript, Tailwind, TanStack Query, Solana Wallet Adapter.
- `apps/api`: NestJS REST and WebSocket API, validation, configuration, structured logging, health endpoint, and read-only Solana RPC proxy.
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

See `.env.example`. The frontend defaults to `NEXT_PUBLIC_DATA_MODE=mock`. This flag selects isolated display data and does not configure production services. The API requires `DATABASE_URL`, `REDIS_URL`, `API_PORT`, and `WEB_ORIGIN`. `SOLANA_NETWORK` accepts `devnet` or `mainnet`; `SOLANA_RPC_URL` and `SOLANA_WS_URL` are blank placeholders and must be supplied together. Keep provider URLs server-side; never add them to `NEXT_PUBLIC_*`. No RPC credentials or program addresses are supplied.

## Stage boundary

## Step 2 market data

The first venue adapter is read-only Polymarket public data and implements the shared `MarketVenueAdapter` contract. It uses the documented Gamma keyset event endpoint for market discovery, the CLOB batch books endpoint for public bid/ask depth, the market WebSocket for live book updates where the Node runtime supports WebSocket, and the documented public price-history endpoint. If the stream is unavailable, the UI identifies the scheduled REST update mode. The adapter is intentionally limited to one venue; no Kalshi or Solana-native venue is represented as integrated. See [Polymarket market discovery docs](https://docs.polymarket.com/market-data/discover-markets), [prices, order books, and history docs](https://docs.polymarket.com/market-data/prices-order-books), and [real-time data docs](https://docs.polymarket.com/market-data/realtime-data).

API routes: `GET /api/v1/markets?q=&category=&venue=&includeClosed=`, `GET /api/v1/markets/polymarket/:id`, and `GET /api/v1/markets/polymarket/:id/history?outcome=0&interval=1d`. The adapter refreshes every 60 seconds, scans up to three 100-event keyset pages per sync, retains recently observed pages for 30 minutes in a bounded 10,000-market process cache, retries transient errors with bounded backoff, and caches order books and history. This is a rolling discovery window, not a claim that every venue market has been indexed. Market records carry source venue, observed time, source update time, expiration, outcome IDs and prices, and null for unavailable numeric values. A failed refresh retains the previous dataset and reports the error in the API response. This cache is per API process; Redis-backed shared caching and durable price-history storage remain incomplete.

`NEXT_PUBLIC_DATA_MODE=live` is the default and uses the backend API. Set it to `mock` only to show the isolated synthetic card list. Live market cards identify Polymarket, show freshness and available volume/liquidity, and link to an internal detail page plus original source. The homepage's summary metrics, static dashboard chart, and sample opportunity cards remain demo-only. The canonical comparison helper requires structured outcome, resolution, expiration, and settlement information before returning an equivalence label; with one connected venue there are no cross-venue equivalent pairs or arbitrage claims.

## Step 3 wallet and quote foundations

The wallet control discovers compatible external Solana wallets through Wallet Standard. The API's `GET /api/v1/solana/rpc/health` reports the selected network and HTTP/WebSocket provider health without returning endpoint URLs. `POST /api/v1/solana/rpc` is a rate-limited, allowlisted read-only JSON-RPC proxy; transaction submission and signing methods are rejected. The UI shows RPC status and the connected wallet's SOL balance. Browser wallet calls use the API's HTTP proxy; WebSocket health is checked server-side.

`POST /api/v1/markets/polymarket/:id/quote` simulates a BUY or SELL against a fresh public order-book depth snapshot, estimates venue fees when the public market fee schedule is known, and reports unknown network costs. Quotes are explicitly estimates and never trigger an order. No venue currently supports configured order submission, cancellation, order tracking, or verified prediction-market positions; portfolio positions are therefore honestly shown as unavailable. Mainnet order execution is disabled. RPC URLs remain placeholders until supplied by the project owner.

## Step 4 PREDICT PM-AMM and risk intelligence

The official `@pm-amm/sdk` v0.2.0 is integrated with the market registry and web client. The API reads PREDICT binary markets from a configured Devnet RPC, verifies the Devnet genesis hash, and normalizes the on-chain names, current model probability, outcome mints, pool value, and expiry. Resolution criteria and settlement source are absent from the account, so the canonical matcher does not treat PREDICT markets as equivalent solely by text. PREDICT probability/liquidity analytics use the SDK's published dynamic pm-AMM math, including current-state reserve rescaling; LVR is labeled as a modeled risk metric rather than a return.

The `Trade`, `Liquidity`, and `Analytics` sections expose PREDICT Devnet market creation, USDC-to-outcome swap estimates, deposits, full LP withdrawals, residual claims, resolved winnings claims, pool analytics, and session probability samples. Every state-changing action requires an explicit wallet signature. Swap previews are short-lived, enforce a capped 0.5–3% minimum-output tolerance, and remain estimates. Signed transaction relay is disabled by default; after you provide the Devnet URLs, set `SOLANA_DEVNET_TRANSACTIONS=true` to enable it. The API will relay only single signed transactions when Devnet genesis verification passes, and it does not retry transaction submission. Mainnet transaction relay is rejected.

The opportunity engine compares Polymarket and PREDICT definitions conservatively. It labels qualifying probability gaps statistical only, suppresses lookalikes without aligned settlement information, and leaves potential/verified executable opportunities disabled because Polymarket order execution and cross-venue reconciliation are not configured. Session analytics are not persisted; durable PREDICT price history, volume/fill indexing, execution-quality analytics, and complete cross-venue portfolio accounting remain incomplete.

PREDICT's official docs disclose centralized resolution, a single-key upgrade authority, no independent audit, and multi-outcome probability drift. This integration does not imply the protocol is audited or risk-free. The app currently pins its integration to PREDICT Devnet and its official Devnet mock-USDC mint. See the [PREDICT builder guide](https://predict-pm-amm.dev/hackathon.md), [SDK reference](https://github.com/sparkfun-labs/pm-amm/blob/main/packages/sdk/README.md), and [protocol limitations](https://predict-pm-amm.dev/#7-limitations).

Explore and unrelated navigation destinations remain foundation placeholders. The API uses default-deny auth and role guards for protected endpoints; public read-only market and RPC endpoints explicitly bypass auth and are rate-limited. No identity/signature verification provider is configured. PostgreSQL migration has not been applied in this environment; market data is not persisted there. Redis-backed shared caching, scheduled workers, WebSocket venue streams, Kalshi integration, durable PREDICT indexing, and cross-venue reconciliation remain incomplete.
