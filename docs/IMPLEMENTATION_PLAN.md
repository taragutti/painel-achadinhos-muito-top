# Implementation plan

> Phased plan with the current verified status. See
> [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for operational details and remaining
> work.

## Phase 0 — foundation and safety (complete)

- Audit the existing repository and preserve its dashboard.
- Record repository-wide safety rules.
- Establish module boundaries and mock-first provider contracts.
- Add `SEND_LIVE=false`, Decimal money, and publication idempotency requirements.
- Create an initial reviewed Prisma migration without applying it to a database.
- Repair baseline tests and verify type checking/builds.

Exit criteria: clean dependency graph, one fictitious `.env.example`, no live delivery path by default, versioned schema, checks passing.

## Phase 1 — domain and persistence (complete)

- Finalize Product, Asset, MessageTemplate, Publication, Destination, Attempt, and Setting models.
- Add repository interfaces and Prisma implementations.
- Add UTC/São Paulo scheduling utilities and Decimal serializers.
- Add unit tests for domain rules and migration review fixtures.

## Phase 2 — private administration boundaries (complete)

- Protect all dashboard and API routes for the single administrator.
- Add server-side authorization for every read/write action.
- Add reusable forms with Zod validation in client and server code.
- Implement understandable Portuguese error states.

## Phase 3 — product and content management (main flow complete)

- Implement product, asset, link, and template CRUD.
- Add safe asset storage and metadata validation.
- Add preview rendering without contacting external providers.

## Phase 4 — scheduling and worker reliability (complete)

- Implement atomic job claiming and stale-lock recovery.
- Add bounded retries, exponential backoff, and a dead-letter state.
- Enforce idempotency at database and provider boundaries.
- Add structured, redacted audit logs and operational metrics.

## Phase 5 — provider certification (pending operational validation)

- Test Telegram and WhatsApp adapters against dedicated sandbox/test destinations.
- Verify API limits, approved WhatsApp templates, consent, and group-delivery constraints.
- Add contract tests using intercepted HTTP; never call live endpoints in automated tests.

## Phase 6 — controlled release (pending)

- Prepare production infrastructure and secret management.
- Run backup and migration rehearsals.
- Require a manual two-person-style checklist even for the single-admin system before setting `SEND_LIVE=true`.
- Enable one provider and one test destination at a time, then monitor.

## Remaining scope before real operation

Provider certification, permanent infrastructure, production secret management,
backup and restore rehearsal, a dedicated test destination, deployment, and
real message delivery remain pending. The local homologation profile stays
mock-only and does not send real messages.
