# Operations

## Safe operating mode

Keep `DEMO_MODE=true`, `SEND_LIVE=false`, `MOCK_PROVIDERS=true` and providers disabled while validating the system. The queue still schedules batches, creates deliveries, retries failures and writes history. The Integrações page can select simulated success, failure or timeout. Confirm the UI shows “simulação” before starting a queue.

## Web runbook

Build with `npm run build --workspace=@achadinhos/web` and start with `npm run start --workspace=@achadinhos/web`. Configure secrets in the runtime secret manager, never in source. Monitor `/api/health` with its bearer token. A database failure returns 503 without connection details. Vercel may host the web application, but uploaded images require durable object storage rather than its ephemeral filesystem.

## Worker runbook

Build with `npm run build --workspace=@achadinhos/worker` and supervise `node apps/worker/dist/index.js`. Provide PostgreSQL, mock/provider flags, poll/lock settings, the worker health token and a persistent WhatsApp session directory. Monitor heartbeat age and alert before two minutes. A restart generates a new run ID; locked work becomes eligible after the lease and completed deliveries remain protected by idempotency.

For QR connection, set `WHATSAPP_ENABLED=true`, `WORKER_API_TOKEN`, `WORKER_HEALTH_TOKEN`, `WORKER_HEALTH_HOST=0.0.0.0` and the platform-provided `PORT`. Keep `SEND_LIVE=false`, open **Grupos**, generate the QR, scan it and authorize exactly one group. Confirm the group name before any later one-message live test.

For an update: pause all queues, wait for current provider calls to finish, stop the old process, apply reviewed migrations, start one new process in demo mode, check health and a mock delivery, then resume. To disconnect or revoke WhatsApp, use the audited controls and preserve logs; revocation intentionally invalidates the stored session.

## Database runbook

Before every release, create an encrypted PostgreSQL backup and restore it into an isolated environment to prove recovery. Review all migrations under `packages/database/prisma/migrations`. Apply production migrations with `prisma migrate deploy` only. Never run reset or db push. Do not delete `Delivery` or `AuditLog` history. Prefer forward-fix migrations and restore only under an approved incident plan.

## Incident response

1. Set `SEND_LIVE=false` and `DEMO_MODE=true` in runtime configuration.
2. Use “Pausar tudo”, then stop the worker if deliveries continue.
3. Preserve structured logs, run IDs, delivery IDs and database backup; do not log message/session contents.
4. Rotate exposed secrets and health tokens.
5. Reconcile each channel using idempotency keys before any retry.
6. Resume first in mock mode, then obtain separate approval for live activation.

## Manual checks before live activation

- Restore the latest backup in isolation.
- Validate TLS, private worker networking and secret-manager access.
- Test login throttling behind the real proxy and ensure forwarded IP headers are sanitized.
- Replace local uploads with durable private object storage.
- Put URL imports behind egress filtering to mitigate DNS rebinding.
- Review provider limits, authorized groups and the concrete WhatsApp connector.
- Run a separately approved test against dedicated destinations; live delivery is not part of automated tests.
