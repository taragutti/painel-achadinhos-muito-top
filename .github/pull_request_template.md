## Resumo

Descreva o objetivo e os efeitos observáveis desta alteração.

## Validação

- [ ] `npm ci`
- [ ] `npm run db:generate`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev --audit-level=high`

## Segurança operacional

- [ ] Nenhum secret, token, cookie ou dado pessoal foi incluído.
- [ ] `DEMO_MODE=true`, `PROVIDER_MODE=mock`, `MOCK_PROVIDERS=true` e `SEND_LIVE=false` continuam sendo os padrões seguros.
- [ ] Nenhuma mensagem real de WhatsApp ou Telegram foi enviada.
- [ ] Nenhum comando destrutivo de Prisma ou banco de dados foi executado.
- [ ] O worker permanente continua fora da Vercel.

## Publicação

- [ ] Preview da Vercel validado antes do merge.
- [ ] Commit exibido no preview corresponde ao commit desta PR.
- [ ] Migrações foram revisadas e serão aplicadas apenas com `prisma migrate deploy`.
- [ ] Rollback e pausa global foram revisados.
