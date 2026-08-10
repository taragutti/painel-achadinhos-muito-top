# Handoff da release candidate

Data de preparação: 2026-08-10

Este documento entrega o caminho para publicar a homologação já validada. Ele não autoriza envio real, push automático, deploy automático ou alteração destrutiva de banco.

## Estado preparado

- Candidata local: `v0.1.0-rc.3`.
- Branch de trabalho: `codex/production-finish`.
- Repositório: `taragutti/painel-achadinhos-muito-top`.
- Projeto web Vercel: `painel-achadinhos-muito-top-web`.
- Root Directory da Vercel: `apps/web`.
- Worker: processo/container permanente separado; nunca executar em Vercel Functions.
- Entrega real: bloqueada por padrão com providers mock e `SEND_LIVE=false`.

## O que será levado ao GitHub

1. Correções finais de homologação e segurança.
2. Atualização de dependências de produção.
3. Evidências de build e runtime do container do worker.
4. Resolução automática da URL pública a partir de `APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL` ou `VERCEL_URL`.
5. Workflow de CI somente para validação, sem etapa de deploy.
6. Template de PR com travas operacionais explícitas.

O PR anterior foi integrado antes das correções finais. Por isso, a publicação deve usar um novo PR da branch `codex/production-finish` para `main`.

## Atualização manual do GitHub

O PR draft #2 já existe. Depois de revisar o diff local do RC3, publique somente o commit incremental e a nova tag:

```sh
git push origin codex/production-finish
git push origin v0.1.0-rc.3
```

Depois, aguarde novamente o workflow **Validate release candidate** e valide o novo preview criado pela integração da Vercel. A tag final `v0.1.0` deve ser criada somente depois do merge e da aprovação do deploy de produção.

## Configuração web na Vercel

Confirme no projeto `painel-achadinhos-muito-top-web`:

- Framework Preset: Next.js.
- Root Directory: `apps/web`.
- Node.js: 24.x.
- Branch de produção: `main`.
- `APP_URL`: URL HTTPS canônica de produção. Se estiver ausente ou apontar para loopback, a aplicação usa a URL de produção fornecida pela Vercel.
- `DATABASE_URL`: banco PostgreSQL de produção, diferente da homologação.
- `APP_ENCRYPTION_KEY`, `APP_HEALTH_TOKEN`, `WORKER_API_TOKEN`: valores únicos armazenados como secrets.
- `WORKER_API_URL`: endpoint HTTPS privado do worker permanente.
- `DEMO_MODE=true`, `PROVIDER_MODE=mock`, `MOCK_PROVIDERS=true`, `SEND_LIVE=false` durante preview, deploy e smoke test.
- Credenciais da Shopee somente quando a integração real for aprovada.

Não copiar valores reais para este documento, GitHub Actions, comentários de PR ou comandos compartilhados.

## Validação do preview

1. Confirmar que o SHA exibido pela Vercel corresponde ao head do novo PR.
2. Confirmar build `READY`.
3. Abrir login e verificar cabeçalhos de segurança.
4. Confirmar que Open Graph aponta para HTTPS, nunca `localhost`.
5. Testar login administrativo e navegação com banco de homologação isolado.
6. Executar o fluxo Shopee → prévia → fila → provider mock → histórico.
7. Confirmar operação pausada, fila vazia e nenhuma entrega real.
8. Verificar logs e erros de runtime sem expor bodies, destinos ou credenciais.

## Promoção para produção

Depois de CI e preview aprovados:

1. integrar o novo PR em `main`;
2. aguardar o deploy automático da Vercel;
3. conferir o SHA do deploy, HTTP 200 e erros de runtime;
4. validar o health check protegido da web;
5. manter filas pausadas e entrega real desabilitada;
6. criar a tag final somente após o aceite operacional.

## Worker permanente

A publicação web não conclui o worker. Em um host separado com volume persistente:

1. aplicar somente migrations revisadas com `prisma migrate deploy`;
2. iniciar exatamente uma revisão do container;
3. confirmar usuário não-root, health HTTP 200 e log estruturado;
4. manter `WHATSAPP_ENABLED=false` e todos os providers mock no primeiro smoke test;
5. configurar sessão e grupo somente em uma etapa operacional separada;
6. nunca executar `docker compose down -v` no volume da sessão.

## Critério de fechamento

A release só estará fechada externamente quando o novo PR estiver integrado, a produção Vercel apontar para o commit aprovado, o worker permanente estiver saudável, a checklist de produção estiver assinada e a documentação registrar o SHA e a data do aceite.
