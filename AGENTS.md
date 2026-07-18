# Painel Achadinhos

## Arquitetura

- `apps/web`: dashboard Next.js/vinext e configuração de publicação do site.
- `apps/worker`: processamento assíncrono das publicações.
- `packages/database`: fonte única do schema Prisma e acesso ao PostgreSQL.
- `packages/shared`: contratos, validações e utilitários sem dependência de infraestrutura.
- `packages/providers`: adaptadores de Telegram, WhatsApp e modo de testes.

## Regras

- Nunca coloque tokens ou credenciais no código; use variáveis de ambiente.
- O modo padrão dos provedores é `test` e não pode enviar mensagens reais.
- Apps podem importar packages; packages nunca importam apps.
- Toda mudança no schema exige migração Prisma versionada.
- Preserve `.openai/hosting.json` dentro de `apps/web`.
- Mantenha integrações externas atrás do contrato `PublicationProvider`.
