# Production Readiness Checklist

This checklist is for a separately approved production environment. The local homologation profile must remain mock-only.

## 1. Scope and approval

- [ ] Confirm the production repository, Vercel project, worker host, PostgreSQL database, and WhatsApp account owner.
- [ ] Record the exact production WhatsApp group and obtain written approval for the first publication.
- [ ] Confirm the message template, affiliate link behavior, schedule, retry policy, and rollback owner.
- [ ] Keep the first rollout limited to one product and one approved group.

## 2. Secrets and environment

- [ ] Store secrets only in the production secret manager; never commit them or paste them into chat.
- [ ] Configure a production `DATABASE_URL` and verify it is not the homologation database.
- [ ] Configure `APP_ENCRYPTION_KEY`, `WORKER_API_TOKEN`, and `WORKER_HEALTH_TOKEN` with unique values of at least 24 characters.
- [ ] Configure valid Shopee affiliate credentials and verify the official GraphQL endpoint.
- [ ] Configure the WhatsApp session directory on a private persistent volume.
- [ ] Confirm production flags are intentionally reviewed: `DEMO_MODE=false`, `PROVIDER_MODE=live`, `MOCK_PROVIDERS=false`, and `SEND_LIVE=true`.
- [ ] Confirm the homologation flags remain `DEMO_MODE=true`, `PROVIDER_MODE=mock`, `MOCK_PROVIDERS=true`, and `SEND_LIVE=false`.

## 3. Database and application

- [ ] Take and verify a restorable PostgreSQL backup.
- [ ] Review every pending Prisma migration; use `prisma migrate deploy` only.
- [ ] Never use `prisma db push` or `prisma migrate reset`.
- [ ] Run typecheck, lint, build, unit tests, and the homologation preflight before promotion.
- [ ] Confirm idempotency constraints and delivery history are present.

## 4. Deployment and observability

- [ ] Build and deploy the web application through the approved Vercel workflow.
- [ ] Start exactly one production worker revision and verify its protected health endpoint returns HTTP 200.
- [ ] Verify structured logs exclude secrets, message bodies, destinations, and authorization headers.
- [ ] Confirm queue pause, retry, disconnect, and rollback controls are available before enabling delivery.

## 5. Controlled first publication

- [ ] Pause all queues while reviewing the first product and destination.
- [ ] Verify the product has a confirmed affiliate link, complete media, and the approved message preview.
- [ ] Resume only the single approved queue item.
- [ ] Monitor the delivery record, provider response, worker heartbeat, and destination result.
- [ ] Immediately restore `SEND_LIVE=false` and pause queues if any unexpected result occurs.
- [ ] Record the delivery idempotency key, timestamps, outcome, and operator approval.

## 6. Post-release

- [ ] Confirm no duplicate delivery occurred.
- [ ] Review failures, retries, and queue timing after the first cycle.
- [ ] Keep a rollback decision and owner documented.
- [ ] Do not expand to additional groups or products until the first publication is reconciled.

