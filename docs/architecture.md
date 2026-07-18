# Arquitetura

## Fluxo de publicação

1. O dashboard cadastra produto, template e agendamento no PostgreSQL.
2. O worker busca publicações com status `QUEUED` e horário vencido.
3. O worker reserva uma publicação, monta a mensagem e seleciona o provedor.
4. O adaptador envia para Telegram, WhatsApp ou apenas registra em modo de testes.
5. Cada tentativa é registrada com status, resposta externa e mensagem de erro.

## Limites dos módulos

- `shared` conhece apenas dados e regras de validação.
- `database` conhece persistência, mas não canais externos.
- `providers` conhece APIs externas, mas não acessa o banco.
- `worker` orquestra banco e provedores.
- `web` apresenta e edita os dados por endpoints protegidos.

## Segurança operacional

O modo de testes é o padrão. Tokens ficam apenas no ambiente de execução. Antes de ativar envios reais, configure números e chats de homologação, limites por minuto, idempotência por publicação e uma política de retentativas.
