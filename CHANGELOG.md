# Changelog

Todas as mudanças relevantes deste projeto são registradas neste arquivo.

## [Não publicado]

### Adicionado

- Uso direto da imagem pública retornada pela Shopee, sem criar uma cópia permanente durante o salvamento do produto.
- Bloqueio explícito de uploads manuais de arquivo na produção Vercel enquanto não houver armazenamento durável.

### Corrigido

- Node.js fixado em 24.x para evitar upgrade automático de major na Vercel.
- Handoff, checklist e checkpoint atualizados com o merge, a CI e o deploy web realmente verificados.

### Validado

- 76 testes, lint, typecheck, build Next.js e auditoria de dependências de produção sem vulnerabilidades.

## [0.1.0-rc.3] - 2026-08-10

### Corrigido

- Variáveis usadas pelo build e runtime web são declaradas explicitamente na tarefa `build` do Turborepo, removendo o risco de filtragem durante o build da Vercel.

### Validado

- 75 testes, lint, typecheck, build Next.js, preflight e auditoria de dependências de produção.
- Preview Vercel do RC anterior chegou a `READY` e revelou a configuração ausente antes do merge.

## [0.1.0-rc.2] - 2026-08-10

### Adicionado

- CI de pull request com lint, typecheck, testes, build e auditoria de dependências de produção.
- Template de PR com verificações de segurança operacional.
- Handoff de publicação para GitHub, Vercel e host permanente do worker.

### Corrigido

- URL pública dos metadados e imagens passa a usar o domínio de produção fornecido pela Vercel quando `APP_URL` estiver ausente ou apontar para loopback.
- Fluxo rápido da Shopee exige prévia e confirmação antes do enfileiramento.
- Contrato da fila, estado offline do worker e inicialização segura do WhatsApp em modo mock.
- Download de imagens, logs seguros e dependências vulneráveis do runtime.

### Validado

- 74 testes, lint, typecheck, build Next.js, migrations e auditoria de dependências de produção.
- Fluxo completo em provider mock, sem envio real.
- Build e runtime isolado do container do worker como usuário não-root.

## [0.1.0-rc.1] - 2026-08-10

- Marco local da homologação funcional anterior ao pacote de publicação.
