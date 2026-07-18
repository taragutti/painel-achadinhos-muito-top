# Architecture

## Status

This repository is an npm/Turborepo monorepo with an operational private dashboard, persistence, mock-safe provider layer and a long-running queue worker. Live-provider activation remains an explicit later operational decision.

## System context

The product is a private, single-administrator dashboard for registering products, creative assets, affiliate links, and message templates. Scheduled publications are persisted in PostgreSQL and processed asynchronously for WhatsApp and Telegram.

## Modules

### `apps/web`

Next.js/TypeScript dashboard. It owns presentation, protected HTTP boundaries, client-side form validation, server-side input validation, and application services. Visual components must not import Prisma or provider implementations.

Authentication uses a single `AdminUser`, a random opaque session token in an HTTP-only cookie, and only a SHA-256 token hash in PostgreSQL. Every private route revalidates the session in its server layout. `ADMIN_EMAIL` is the final allowlist and public sign-up/recovery routes do not exist.

### `apps/worker`

Node.js/TypeScript background processor. It claims due jobs with PostgreSQL row locks, enforces delivery idempotency, invokes provider contracts, records attempts, applies bounded retry policy and persists heartbeat/metrics. It exposes a token-protected health server and has a unique run identifier on every restart.

### `packages/database`

Owns the Prisma schema, generated client, versioned migrations, repositories, and transaction helpers. PostgreSQL stores timestamps in UTC, monetary values as `Decimal`, and a unique idempotency key for each publication.

### `packages/shared`

Owns Zod schemas, domain contracts, date/time helpers, money serialization, error codes, and other infrastructure-free functions. Schemas are reused at client and server boundaries.

### `packages/providers`

Owns `PublicationProvider` adapters. Mock is the default. Telegram and WhatsApp adapters can be selected only when `PROVIDER_MODE=live` and `SEND_LIVE=true` are both explicitly configured.

The current messaging contract is `MessagingProvider`. Its factory forces mock unless `SEND_LIVE=true` and `MOCK_PROVIDERS=false`. Telegram HTTP concerns remain inside its adapter. WhatsApp runs only in `apps/worker`: a replaceable connector owns QR, persistent session, group discovery and heartbeat, while the web app reads only sanitized status.

The worker creates one `Delivery` for each queue item, channel and attempt. Its idempotency key combines the stable queue item key and channel; successful deliveries are not repeated and retries stop at `DELIVERY_MAX_ATTEMPTS`.

`DEMO_MODE=true` is a stronger interlock: provider selection is always mock, regardless of configured tokens. The selected simulation behavior is stored in `AppSetting`, so an administrator can exercise success, failure and timeout through the complete queue and history flow.

Queue scheduling uses a short PostgreSQL transaction with `FOR UPDATE SKIP LOCKED` to claim one due queue, plus a lease token so a crashed worker can be recovered. The lock is released before provider I/O. Due items are separately claimed with row locking, allowing restart recovery without resending the same logical delivery. Delivery idempotency is uniquely constrained as queue item + channel + logical attempt.

Rounds honor `itemsPerBatch`, `intervalMinutes`, `secondsBetweenItems`, the São Paulo daily window, global pause, per-queue pause and repeat cooldown. Channel failures are isolated: a successful channel remains complete while only failed channels retry with progressive backoff.

## Dependency direction

```text
apps/web ───────► packages/shared
     │           packages/database
     └─────────► application services ─► database repositories

apps/worker ───► packages/shared
     ├─────────► packages/database
     └─────────► packages/providers ───► external APIs
```

Packages never import apps. Provider adapters never access Prisma. Visual components never import repositories.

## Observability

The web health route verifies PostgreSQL readiness and is protected by `APP_HEALTH_TOKEN`. The worker health server is bound to `127.0.0.1` by default, requires `WORKER_HEALTH_TOKEN`, and reports heartbeat age, run ID, last processing timestamp and aggregate counters. Worker events use structured, redacted logs; message bodies, destinations, session data and secrets are excluded.

## Publication lifecycle

`DRAFT → QUEUED → PROCESSING → PUBLISHED | FAILED | CANCELLED`

Every publication receives a unique idempotency key before entering `QUEUED`. The worker must atomically claim work, pass the same key to the provider, and persist every attempt. A future retry must reuse the original key.

## Time and money

- Store all timestamps as UTC.
- Convert to `America/Sao_Paulo` only at display and scheduling boundaries.
- Store money as PostgreSQL `DECIMAL(12,2)` through Prisma `Decimal`.
- Serialize money as strings across JSON boundaries to avoid floating-point loss.

## Target folder structure

```text
painel-achadinhos/
├── apps/
│   ├── web/
│   └── worker/
├── packages/
│   ├── database/
│   │   └── prisma/migrations/
│   ├── shared/
│   └── providers/
├── docs/
├── AGENTS.md
├── .env.example
├── package.json
└── turbo.json
```
