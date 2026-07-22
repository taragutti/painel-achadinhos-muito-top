# Deployment

This guide describes a future safe release. No deployment is performed by this repository task.

## Proposed topology

- Private Next.js application running on a Node.js-compatible host, required by Prisma/PostgreSQL sessions.
- Long-running Node.js worker with controlled outbound network access.
- Managed PostgreSQL with backups and point-in-time recovery.
- Managed object storage for creative assets.
- Central secret manager for database and provider credentials.

The web application and background worker have different process lifecycles. Production hosting must be selected only after confirming Node.js support, a persistent worker, private access, PostgreSQL connectivity, asset storage, and secret injection. The legacy Cloudflare/vinext packaging files are preserved for reference but are not the active authentication runtime.

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

Configure the web workspace build, `DATABASE_URL`, `APP_URL`, administrator/session variables, `APP_ENCRYPTION_KEY`, `APP_HEALTH_TOKEN`, `DEMO_MODE=true`, `SEND_LIVE=false` and durable image storage. Do not place the WhatsApp client, session files or permanent queue loop in Vercel Functions. Restrict dashboard ingress with an additional access layer when possible.

Configure `WORKER_API_URL` and the same strong `WORKER_API_TOKEN` in Vercel and in the worker host. The worker must expose its configured `PORT` over HTTPS, bind to `0.0.0.0`, and mount `WHATSAPP_SESSION_DIR` on a persistent private volume. Never mount that directory in the web deployment or commit its contents.

## Permanent worker

Use a supervised Node.js process or container with restart-on-failure, graceful termination, PostgreSQL access and a persistent volume for `WHATSAPP_SESSION_DIR`. Bind health to a private interface, configure a unique token, ship structured logs, alert on stale heartbeat, and deploy only one new worker revision at a time. Database locks and idempotency protect overlap, but rolling overlap should remain brief.

## Live activation

Deployment and live delivery are separate decisions. After a healthy deployment, enable one test destination first. Setting `SEND_LIVE=true` requires an explicit operational approval and must never be part of a default configuration.

## Rollback

Disable live delivery, stop the worker, roll back application code, and prefer forward-fix database migrations. Do not delete data or reverse a migration destructively without a separately reviewed recovery plan.
