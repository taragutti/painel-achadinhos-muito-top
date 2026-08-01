# Checkpoint da sessão

Data: 2026-07-30

## Estado confirmado

- Homologação local aprovada pelo preflight.
- PostgreSQL local preservado e administrador cadastrado.
- Docker Desktop voltou a responder.
- Worker em container está `healthy` na porta local `9464`.
- `/health` protegido respondeu HTTP 200.
- Providers mock ativos e `SEND_LIVE=false`.
- Testes de configuração passaram e o build do worker foi concluído.

## Correções recentes

- Imagem do worker reconstruída sem cache após manifesto JSON corrompido.
- `WORKER_DATABASE_URL` usa `host.docker.internal` para alcançar o PostgreSQL do Mac.
- `npm run env:use-local-db -- achadinhos-homolog-20260728` prepara as duas URLs sem imprimir credenciais.

## Próxima etapa segura

1. Iniciar a aplicação web local.
2. Testar login e importação mock de uma oferta.
3. Testar enfileiramento e agendamento sem publicação real.
4. Planejar certificação separada de Shopee e WhatsApp.

Não fazer deploy, push, reset do Docker, `prisma db push`, `prisma migrate reset` ou envio real.
