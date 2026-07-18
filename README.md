# Painel Achadinhos Muito Top

Monorepo do dashboard privado e do fluxo de publicações para Telegram e WhatsApp.

## Estrutura

```text
apps/web             Dashboard Next.js
apps/worker          Worker de publicações
packages/database    Prisma + PostgreSQL
packages/shared      Tipos e validações
packages/providers   Telegram, WhatsApp e modo de testes
docs                 Decisões e guias
```

## Primeiros passos

1. Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
2. Rode `npm install`.
3. Gere o Prisma Client com `npm run db:generate`.
4. Crie o banco local com `npm run db:migrate`.
5. Inicie tudo com `npm run dev`.

O worker usa `PROVIDER_MODE=test` por padrão. Nenhuma mensagem real é enviada até essa variável ser alterada conscientemente e as credenciais dos canais serem configuradas.

## Comandos

- `npm run dev:web`: somente o dashboard.
- `npm run dev:worker`: somente o worker.
- `npm run build`: compila apps e pacotes na ordem correta.
- `npm run typecheck`: verifica os contratos TypeScript.
- `npm run db:generate`: atualiza o Prisma Client.
- `npm run db:migrate`: cria uma migração local.

Consulte [docs/architecture.md](docs/architecture.md) para o fluxo completo.
