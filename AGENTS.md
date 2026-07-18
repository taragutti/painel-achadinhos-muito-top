# Painel Achadinhos Muito Top — repository rules

These rules apply to the entire repository.

## Non-negotiable safety rules

1. Do not push commits or branches.
2. Do not deploy or publish the application.
3. Never run `prisma migrate reset`.
4. Never run `prisma db push`.
5. Never delete or truncate databases, tables, migrations, or existing data.
6. Never send a real WhatsApp or Telegram message during development or tests.
7. Never commit keys, passwords, tokens, cookies, credentials, or real personal data.
8. Never print secret environment values in logs, errors, snapshots, or test output.
9. Keep exactly one committed `.env.example`, at the repository root, with fictitious values only.
10. Use reviewed and versioned Prisma migrations for every schema change.
11. Keep TypeScript `strict` mode enabled in every workspace.
12. Validate untrusted inputs at both the client boundary and the server boundary.
13. Use structured logs that exclude secrets, message bodies, destinations, and authorization headers.
14. Every external integration must provide a mock adapter.
15. `SEND_LIVE` must default to `false`; live providers require an explicit `SEND_LIVE=true` check.
16. Do not add abandoned or unmaintained libraries without documenting the reason and alternatives.
17. Do not copy DivulgaNinja code, visual design, copy, assets, or brand identity.
18. Preserve the original identity of Painel Achadinhos Muito Top.
19. Preserve existing code unless a requested change or a verified defect requires modification.
20. Stop immediately and report the risk before any destructive or irreversible operation.

## Engineering conventions

- Internal names, filenames, identifiers, code, and code comments are written in English.
- User-interface text is written in Brazilian Portuguese.
- Components are small, focused, accessible, and reusable.
- Business rules live outside visual components.
- Visual components never access Prisma directly.
- Database access is isolated in `packages/database` and application services.
- External systems are accessed only through adapters/providers in `packages/providers`.
- Errors are caught, mapped to safe messages, and shown to the administrator in understandable language.
- Persist dates as UTC and display them in the `America/Sao_Paulo` timezone.
- Persist monetary values using Prisma `Decimal` backed by PostgreSQL `DECIMAL/NUMERIC`.
- Every publication has a unique, stable idempotency key.
- Apps may depend on packages; packages must never depend on apps.
- The default provider is always mock. Tests must not have a path to live network publication.

## Repository boundaries

- `apps/web`: private dashboard and server-side application boundaries.
- `apps/worker`: queue orchestration and publication processing.
- `packages/database`: Prisma schema, migrations, client, and repositories.
- `packages/shared`: schemas, contracts, dates, money, and shared pure functions.
- `packages/providers`: mock, Telegram, and WhatsApp adapters.
- `docs`: architecture, security, implementation, and deployment documentation.
