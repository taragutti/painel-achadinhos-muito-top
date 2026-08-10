# Checkpoint da sessão

Data: 2026-08-10

## Estado confirmado

- Homologação local aprovada pelo preflight.
- PostgreSQL de homologação preservado, com 8 migrations aplicadas e schema atualizado.
- Providers mock ativos com `DEMO_MODE=true`, `PROVIDER_MODE=mock`, `MOCK_PROVIDERS=true` e `SEND_LIVE=false`.
- Operação global pausada, sem itens pendentes ou em processamento ao encerrar os testes.
- Web, worker e contêiner PostgreSQL usados nos testes foram encerrados.
- Nenhuma mensagem real de WhatsApp ou Telegram foi enviada.
- Dependências de produção auditadas com `npm audit --omit=dev`: zero vulnerabilidades.

## Fluxos validados

- Login administrativo local.
- Importação determinística de link fictício da Shopee sem acesso à API externa.
- Prévia da mensagem e confirmação explícita antes do enfileiramento.
- Persistência do produto, publicação e item da fila.
- Processamento pelo provider mock e entrega registrada como enviada no histórico.
- Pausa global, pausa e retomada da fila, adição e remoção idempotente de item pendente.
- Tela de canais com worker disponível, indisponível e recuperado, sem iniciar conexão real automaticamente no modo mock.
- Dashboard final com operação pausada, fila vazia e zero falhas atuais.
- Verificação visual final sem erros de console e com um único elemento `main` por página testada.

## Correções concluídas

- `npm run dev:web` e `npm run dev:worker` carregam com segurança o único `.env` da raiz.
- O fluxo rápido da Shopee mostra a prévia da mensagem antes de confirmar a fila.
- A tela de canais diferencia worker offline de WhatsApp desconectado e remove o aviso obsoleto após a recuperação.
- O modo mock não inicializa automaticamente a sessão real do WhatsApp.
- Logs não estruturados de dependências são suprimidos antes que detalhes internos de sessão cheguem ao terminal.
- O worker baixa imagens por cliente HTTP seguro, limita tamanho e tempo e valida a assinatura do arquivo.
- O carregamento inicial e os refreshes da fila usam o mesmo contrato serializado.
- As raízes dos gerenciadores de fila e canais não criam elementos `main` aninhados.
- Next.js, React, Sharp, PostCSS, NanoID, Cloudflare Vite Plugin, Wrangler e Vite foram atualizados para versões corrigidas.
- O worker declara Sharp 0.35.3 explicitamente para impedir que o peer do Baileys use a versão vulnerável das ferramentas legadas.
- Next.js 16.3 adicionou regras locais que direcionam agentes à documentação correspondente à versão instalada.

## Validação de 2026-08-10

- `npm test`: aprovado — 69 testes no total, sem falhas.
- Build de produção do Next.js e builds TypeScript: aprovados pela pipeline de testes.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm run preflight:homologation`: configuração aprovada.
- `prisma migrate status`: banco atualizado, 8 migrations encontradas.
- E2E local no navegador: aprovado em perfil mock.
- Smoke test após o upgrade para Next.js 16.3.0: dashboard, filas e canais aprovados sem erros de console.
- Auditoria de produção: zero vulnerabilidades conhecidas no registro npm em 2026-08-10.
- Auditoria completa: dois alertas altos permanecem somente no `image-size` transitivo do empacotamento legado `vinext`, que não participa do build Next.js nem do runtime de produção atual.
- `docker compose -f compose.worker.homologation.yaml config --quiet`: aprovado.
- Imagem `painel-achadinhos-worker:local`: construída do zero com `npm ci`, builds dos quatro workspaces do runtime e zero vulnerabilidades na instalação do container.
- Inspeção da imagem: usuário não-root `node`, healthcheck configurado, `DEMO_MODE=true`, `PROVIDER_MODE=mock`, `SEND_LIVE=false` e `WHATSAPP_ENABLED=false`.
- Runtime da imagem validado em projeto Compose isolado: container saudável, endpoint protegido `/health` com HTTP 200 e log estruturado confirmando `mockProviders=true` e `sendLive=false`.
- O container e a rede temporários foram removidos sem `-v`; o volume foi preservado e o PostgreSQL local voltou ao estado parado.

## Próxima etapa segura

O projeto está pronto para revisão final e versionamento local. Se o empacotamento legado `vinext` voltar a ser usado, ele deve ser migrado e auditado separadamente antes da execução. Certificação de credenciais reais, envio real, deploy, publicação, push e abertura de PR permanecem fora deste checkpoint e exigem uma etapa separada e explicitamente autorizada.

Não fazer deploy, push, reset do Docker, `prisma db push`, `prisma migrate reset` ou envio real.
