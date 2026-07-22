# Painel Achadinhos Muito Top

Monorepo do dashboard privado e do fluxo de publicações para Telegram e WhatsApp. O sistema inclui autenticação de administrador único, produtos, três tipos de publicação, templates, filas agendadas, histórico imutável, providers substituíveis e modo de demonstração sem rede externa.

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
2. Rode `npm ci`.
3. Gere o Prisma Client com `npm run db:generate`.
4. Crie o banco local com `npm run db:migrate`.
5. Inicie tudo com `npm run dev`.

Antes do primeiro login, defina `ADMIN_EMAIL` e execute `npm run admin:upsert --workspace=@achadinhos/database`. A senha é lida de `ADMIN_INITIAL_PASSWORD` ou solicitada de forma oculta no terminal.

O worker usa `DEMO_MODE=true`, `PROVIDER_MODE=mock` e `SEND_LIVE=false` por padrão. Nesse modo a fila, as tentativas e o histórico funcionam normalmente, mas nenhuma API externa é chamada. Em Integrações, o administrador pode simular sucesso, falha ou timeout.

## Aplicação web

O dashboard é uma aplicação Next.js para um único administrador. Todas as páginas internas revalidam a sessão no servidor; mutações validam origem e entrada. Em Vercel, configure apenas a aplicação web, PostgreSQL, secrets e armazenamento durável de imagens. O worker e a sessão do WhatsApp não podem executar em Functions da Vercel.

O endpoint `GET /api/health` exige `Authorization: Bearer <APP_HEALTH_TOKEN>` e verifica a conectividade com o banco sem retornar detalhes de credenciais.

### Importação da Shopee

O importador resolve o link informado pelo administrador, identifica produto e loja e complementa os metadados pela API oficial de Afiliados da Shopee. A assinatura é calculada somente no servidor e nenhuma credencial retorna ao navegador.

Configure `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET` e `SHOPEE_API_BASE_URL`. `SHOPEE_AFFILIATE_ID` permanece disponível para recursos vinculados à conta. O endpoint suportado é `https://open-api.affiliate.shopee.com.br/graphql`.

## Worker

O worker é um processo Node.js permanente, separado da web, com acesso ao PostgreSQL e diretório persistente para a sessão do WhatsApp. `GET /health` na porta configurada exige `WORKER_HEALTH_TOKEN` e expõe heartbeat, identificação da execução, último processamento e contadores básicos.

O menu **Grupos** conversa com o worker por HTTPS usando `WORKER_API_URL` e `WORKER_API_TOKEN`. O navegador nunca recebe esse token nem os arquivos da sessão: recebe somente o QR temporário convertido em imagem, o estado sanitizado e os nomes dos grupos. A conexão por QR usa um cliente não oficial do WhatsApp e pode sofrer desconexões ou bloqueios; `SEND_LIVE=false` continua impedindo publicações reais.

## Banco de dados

Use somente migrations Prisma versionadas. Em desenvolvimento, `db:migrate` cria/aplica migrations após revisão. Em produção, faça backup verificável e use `prisma migrate deploy`. Nunca execute `prisma db push`, `prisma migrate reset` ou apague histórico.

## Comandos

- `npm run dev:web`: somente o dashboard.
- `npm run dev:worker`: somente o worker.
- `npm run build`: compila apps e pacotes na ordem correta.
- `npm run lint`: verifica a aplicação web.
- `npm test`: executa os testes unitários e de integração isolados.
- `npm run typecheck`: verifica os contratos TypeScript.
- `npm run db:generate`: atualiza o Prisma Client.
- `npm run db:migrate`: cria uma migração local.

Consulte `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md` e `docs/OPERATIONS.md` antes de operar ou implantar.
