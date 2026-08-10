# Handoff e aceite da release candidate

Data de preparação: 2026-08-10

Este documento registra a publicação web já validada e o caminho restante para concluir o worker permanente. Ele não autoriza envio real, push automático, deploy automático ou alteração destrutiva de banco.

## Estado externo verificado

- PR [#3](https://github.com/taragutti/painel-achadinhos-muito-top/pull/3) integrado em `main` em 2026-08-10, após o PR [#2](https://github.com/taragutti/painel-achadinhos-muito-top/pull/2).
- Commit de merge atual: `e0820f0a65266b211f682a41325a047016765b50`.
- Workflow [Validate release candidate](https://github.com/taragutti/painel-achadinhos-muito-top/actions/runs/31415468880) concluído com sucesso no commit de merge atual.
- Deploy de produção Vercel `dpl_BPiu9bF6uteu7F7SoBWx3tqq1zsH` em estado `READY` e associado ao commit atual.
- URL canônica: <https://painel-achadinhos-muito-top-web.vercel.app>.
- Login público respondeu HTTP 200, com cabeçalhos de segurança e metadados Open Graph em HTTPS.
- A consulta sem credencial ao health check protegido respondeu HTTP 401, conforme o desenho de segurança.
- Não foram encontrados erros `error` ou `fatal` nos logs de runtime durante a janela de validação do deploy atual.
- Produção web permanece em homologação segura: providers mock e `SEND_LIVE=false`, conforme configuração confirmada pelo operador.

O health check autenticado com banco e o worker permanente ainda precisam de aceite operacional. O fluxo aprovado usa a imagem pública da Shopee e não exige armazenamento próprio. Nenhum secret foi lido ou registrado nesta validação.

## Estado preparado

- Candidata publicada: `v0.1.0-rc.3`.
- Branch de trabalho: `codex/production-finish`.
- Repositório: `taragutti/painel-achadinhos-muito-top`.
- Projeto web Vercel: `painel-achadinhos-muito-top-web`.
- Root Directory da Vercel: `apps/web`.
- Worker: processo/container permanente separado; nunca executar em Vercel Functions.
- Entrega real: bloqueada por padrão com providers mock e `SEND_LIVE=false`.

## O que foi levado ao GitHub

1. Correções finais de homologação e segurança.
2. Atualização de dependências de produção.
3. Evidências de build e runtime do container do worker.
4. Resolução automática da URL pública a partir de `APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL` ou `VERCEL_URL`.
5. Workflow de CI somente para validação, sem etapa de deploy.
6. Template de PR com travas operacionais explícitas.

As correções finais e o fluxo de imagens públicas da Shopee foram integrados pelos PRs #2 e #3. Alterações posteriores devem usar outro PR e repetir CI, preview e aceite de produção.

## Atualização manual do GitHub — concluída

Os comandos abaixo foram executados pelo operador durante a publicação do RC3:

```sh
git push origin codex/production-finish
git push origin v0.1.0-rc.3
```

O workflow, o preview e os deploys de produção dos PRs #2 e #3 foram aprovados. A tag final `v0.1.0` continua reservada para depois do health check autenticado e do worker permanente saudável.

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
- Imagens de produtos: usar diretamente a URL pública retornada pela Shopee dentro da janela operacional curta; uploads manuais permanecem desabilitados na produção.

Não copiar valores reais para este documento, GitHub Actions, comentários de PR ou comandos compartilhados.

## Validação do preview — concluída

1. SHA do preview correspondente ao head aprovado: concluído.
2. Build `READY`: concluído.
3. Login e cabeçalhos de segurança: concluído.
4. Open Graph em HTTPS, sem `localhost`: concluído.
5. Login administrativo e navegação com banco isolado: validado na homologação local; repetir no aceite autenticado de produção.
6. Fluxo Shopee → prévia → fila → provider mock → histórico: validado na homologação local.
7. Operação pausada, fila vazia e nenhuma entrega real: validado na homologação local.
8. Logs de runtime sem erros fatais e sem secrets expostos: concluído para a janela do deploy.

## Promoção web para produção — concluída

1. PR integrado em `main`: concluído.
2. Deploy automático da Vercel: concluído.
3. SHA, HTTP 200 e erros de runtime: concluído.
4. Proteção do health check: concluída; resposta autenticada com banco ainda pendente.
5. Filas pausadas e entrega real desabilitada: mantido.
6. Tag final: pendente até o aceite operacional completo.

## Worker permanente

A publicação web não conclui o worker. Em um host separado com volume persistente:

1. aplicar somente migrations revisadas com `prisma migrate deploy`;
2. iniciar exatamente uma revisão do container;
3. confirmar usuário não-root, health HTTP 200 e log estruturado;
4. manter `WHATSAPP_ENABLED=false` e todos os providers mock no primeiro smoke test;
5. configurar sessão e grupo somente em uma etapa operacional separada;
6. nunca executar `docker compose down -v` no volume da sessão.

## Critério de fechamento

A etapa web está integrada, documentada e publicada em modo seguro. A release completa só estará fechada externamente quando o worker permanente estiver saudável, o health check autenticado confirmar o banco, a checklist de produção estiver assinada e a data do aceite operacional estiver registrada.
