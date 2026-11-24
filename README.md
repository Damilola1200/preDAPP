# Solana Prediction Market Aggregator

One market. Multiple venues. Smarter execution.

This repository is being built in stages. Only Step 1 (foundation and architecture) is in scope. No real market venue or trading integrations are configured. Dashboard data is explicitly mocked.

## Architecture

- `apps/web`: Next.js App Router, React, TypeScript, Tailwind, TanStack Query, Solana Wallet Adapter.
- `apps/api`: NestJS REST and WebSocket API, validation, configuration, structured logging, health endpoint.
- `packages/database`: Prisma schema and migration tooling for PostgreSQL.
- `programs`: reserved for future Anchor programs; no on-chain trading code is included in Step 1.

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

Explore and other dashboard navigation destinations are foundation UI placeholders. Search filters the isolated mock list, and the theme choice is saved in the browser. Solana Wallet Adapter context is prepared for devnet; wallet adapters and actual wallet connection remain in Step 3. The API uses default-deny authentication and role authorization guards; no identity/signature verification provider is configured, so protected endpoints remain unavailable until one is added. Step 1 also establishes PostgreSQL/Redis clients and readiness reporting, request validation, audit schema, logging, rate limits, and secure configuration. Real venue adapters, orders, portfolio reconciliation, AMM, arbitrage, compliance and production deployment are later stages.
