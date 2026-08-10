# Deployment

This guide describes a future safe release. No deployment is performed by this repository task.

## Proposed topology

- Private Next.js application running on a Node.js-compatible host, required by Prisma/PostgreSQL sessions.
- Long-running Node.js worker with controlled outbound network access.
- Managed PostgreSQL with backups and point-in-time recovery.
- Managed object storage only if manual creative-asset uploads are enabled later.
- Central secret manager for database and provider credentials.

The web application and background worker have different process lifecycles. Production hosting must be selected only after confirming Node.js support, a persistent worker, private access, PostgreSQL connectivity and secret injection. Add asset storage only if manual uploads are enabled later. The legacy Cloudflare/vinext packaging files are preserved for reference but are not the active authentication runtime.

The WhatsApp connector must run only in the long-running worker with persistent session storage. It must never run in a Vercel Function or the Next.js dashboard. Keep `SEND_LIVE=false` and `MOCK_PROVIDERS=true` until the concrete WhatsApp client, authorized group and credentials have been separately reviewed.

## Release prerequisites

1. All type checks, unit tests, integration tests, and builds pass from a clean install.
2. The Prisma migration SQL is reviewed and a backup exists.
3. A migration rehearsal succeeds against a disposable database restored from a sanitized backup.
4. Authentication and server-side authorization are verified.
5. Provider tests use dedicated test destinations.
6. `SEND_LIVE=false` remains set during deployment and smoke testing.
7. Rollback and worker-stop procedures are tested.

## Database release procedure

Stop the worker, take and verify a restorable PostgreSQL backup, review every versioned `migration.sql`, and rehearse against a disposable restored copy. In production use `npm exec prisma migrate deploy --workspace=@achadinhos/database`; never use `prisma db push` or `prisma migrate reset`. Start the web first in simulation, then one worker, and confirm both protected health endpoints before resuming queues.

## Web on Vercel

Configure the web workspace with `apps/web` as the Root Directory, Node.js 24.x, `DATABASE_URL`, `APP_URL`, administrator/session variables, `APP_ENCRYPTION_KEY`, `APP_HEALTH_TOKEN`, `DEMO_MODE=true` and `SEND_LIVE=false`. `APP_URL` should be the canonical HTTPS production URL; when it is absent or points to loopback on Vercel, the application falls back to `VERCEL_PROJECT_PRODUCTION_URL` and then `VERCEL_URL`. Do not place the WhatsApp client, session files or permanent queue loop in Vercel Functions. Restrict dashboard ingress with an additional access layer when possible.

The supported production product flow keeps the public marketplace image URL returned by the Shopee import and does not create an owned copy. The worker downloads that URL only when processing the publication. Manual file uploads are disabled in Vercel production; enable them only after adding reviewed durable object storage. Marketplace URLs can change or expire, so queue and deliver products within the operator's short retention window.

Configure `WORKER_API_URL` and the same strong `WORKER_API_TOKEN` in Vercel and in the worker host. The worker must expose its configured `PORT` over HTTPS, bind to `0.0.0.0`, and mount `WHATSAPP_SESSION_DIR` on a persistent private volume. Never mount that directory in the web deployment or commit its contents.

## Permanent worker

Use a supervised Node.js process or container with restart-on-failure, graceful termination, PostgreSQL access and a persistent volume for `WHATSAPP_SESSION_DIR`. Bind health to a private interface, configure a unique token, ship structured logs, alert on stale heartbeat, and deploy only one new worker revision at a time. Database locks and idempotency protect overlap, but rolling overlap should remain brief.

The repository includes `apps/worker/Dockerfile`, built from the repository root:

```sh
docker build -f apps/worker/Dockerfile -t painel-achadinhos-worker:local .
```

The image runs as a non-root user and starts with mock providers, WhatsApp, and live delivery disabled. Supply `DATABASE_URL`, a unique `WORKER_HEALTH_TOKEN` of at least 24 characters, and a separate `WORKER_API_TOKEN` through the host secret manager. Mount `/var/lib/achadinhos/whatsapp-session` on an encrypted persistent volume. Do not put tokens in the image or command line.

The container health check calls the protected `/health` endpoint with `WORKER_HEALTH_TOKEN`. It returns healthy only after a complete database-backed worker cycle and becomes unavailable after a cycle or state-persistence error; a live process without PostgreSQL is therefore not considered ready. Expose port `9464` only on a private network shared with the dashboard. On `SIGTERM` or `SIGINT`, the worker stops polling, lets the active cycle finish, disconnects WhatsApp without revoking its saved session, closes the health server, and disconnects Prisma.

Apply reviewed migrations as a separate release job before starting the new worker. The worker image intentionally does not run migrations during startup.

## Worker homologation

`compose.worker.homologation.yaml` provides a persistent, restartable worker profile whose live-delivery flags are fixed to safe values. It requires `DATABASE_URL`, `WORKER_HEALTH_TOKEN`, and `WORKER_API_TOKEN` from the host environment and publishes health only on the host loopback interface.

Validate the resolved configuration before starting it:

```sh
docker compose -f compose.worker.homologation.yaml config
```

Then use `docker compose -f compose.worker.homologation.yaml up -d --build` only on the reviewed worker host. Enabling `WHATSAPP_ENABLED=true` may establish the account session for QR/group configuration, but the profile still forces all publication delivery through mock providers. Never use `docker compose down -v`; the named volume contains the persistent WhatsApp session.

## Live activation

Deployment and live delivery are separate decisions. After a healthy deployment, enable one test destination first. Live delivery requires all three explicit gates (`PROVIDER_MODE=live`, `MOCK_PROVIDERS=false`, and `SEND_LIVE=true`) with `DEMO_MODE=false`; inconsistent or incomplete activation makes the worker refuse startup. Setting these values requires an explicit operational approval and must never be part of a default configuration.

## Rollback

Disable live delivery, stop the worker, roll back application code, and prefer forward-fix database migrations. Do not delete data or reverse a migration destructively without a separately reviewed recovery plan.
