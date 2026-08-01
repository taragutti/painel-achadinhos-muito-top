# Guia do projeto — Painel Achadinhos Muito Top

## 1. Objetivo

O Painel Achadinhos Muito Top é uma aplicação privada para automatizar a publicação de ofertas:

1. o administrador cola um link de produto da Shopee;
2. o servidor consulta os dados do produto e solicita o link oficial de afiliado;
3. a oferta é salva e colocada na fila;
4. o worker publica no grupo autorizado;
5. o painel apresenta fila, histórico e falhas.

A configuração inicial da fila é uma publicação a cada 20 minutos, todos os dias, das 08:00 às 22:00 no fuso `America/Sao_Paulo`.

## 2. Estado atual

### Implementado e validado

- dashboard privado para um único administrador;
- formulário rápido para importar uma oferta da Shopee e colocá-la na fila;
- importador Shopee com assinatura executada somente no servidor;
- confirmação de link afiliado antes do enfileiramento;
- produtos, publicações, canais, filas, entregas e histórico em PostgreSQL;
- agendamento diário, pausa global e pausa por fila;
- worker permanente com locks, leases, idempotência e tentativas limitadas;
- providers mock, Telegram e conector WhatsApp;
- conexão WhatsApp por QR e seleção de um único grupo;
- health checks protegidos da web e do worker;
- encerramento gracioso do worker;
- Dockerfile e Compose de homologação;
- migrations Prisma versionadas;
- testes, lint, typecheck e builds passando.

### Ainda necessário antes da operação real

- infraestrutura permanente para PostgreSQL, worker e armazenamento de imagens;
- credenciais de produção da Shopee guardadas em um secret manager;
- sessão WhatsApp criada no host permanente e grupo confirmado;
- backup e restauração do PostgreSQL ensaiados;
- revisão autorizada das dependências;
- teste operacional aprovado com um destino dedicado;
- aprovação explícita para retirar o sistema do modo mock.

Nenhum deploy ou envio real faz parte da preparação local descrita neste documento.

## 3. Fluxo principal

```text
Administrador
    │
    ▼
Dashboard Next.js
    │  cola o link da Shopee
    ▼
Importador Shopee
    │  busca produto + gera link afiliado
    ▼
PostgreSQL
    │  produto + publicação + item de fila
    ▼
Worker permanente
    │  agenda entre 08:00 e 22:00
    │  respeita intervalo de 20 minutos
    ▼
Provider mock ou WhatsApp autorizado
    │
    ▼
Delivery + histórico imutável
```

O worker nunca recebe comandos diretamente do navegador. A aplicação web usa uma API privada protegida por token para consultar o status do WhatsApp, exibir o QR temporário e selecionar o grupo.

## 4. Estrutura do repositório

```text
apps/web
  Dashboard Next.js, autenticação, páginas privadas e APIs.

apps/worker
  Agendamento, processamento da fila, WhatsApp e health server.

packages/database
  Prisma, migrations, repositórios e serviços de persistência.

packages/providers
  Importadores de marketplace e providers mock/Telegram/WhatsApp.

packages/shared
  Schemas Zod, contratos e regras puras compartilhadas.

docs
  Arquitetura, segurança, operações e implantação.
```

A direção permitida é `apps → packages`. Pacotes nunca dependem de aplicações, componentes visuais não acessam Prisma e integrações externas ficam em adapters.

## 5. Requisitos locais

- Node.js 22.13 ou superior;
- npm compatível com o `packageManager` do projeto;
- PostgreSQL;
- Docker Desktop, opcional, para validar o worker em container.

## 6. Configuração local segura

Crie um `.env` ignorado pelo Git a partir do exemplo:

```sh
cp .env.example .env
npm run env:prepare-local
npm ci
npm run db:generate
```

O preparador gera localmente chaves e tokens, fixa as travas mock e nunca imprime
os valores. Depois, preencha banco, administrador e Shopee. O repositório deve
continuar com exatamente um `.env.example`, na raiz, contendo somente valores
fictícios.

Se já existir um PostgreSQL local em Docker, a conexão pode ser configurada sem
exibir a senha:

```sh
npm run env:use-local-db -- NOME_DO_CONTAINER
```

Esse comando mantém `DATABASE_URL` apontando para o host local e também prepara
`WORKER_DATABASE_URL` com `host.docker.internal`, permitindo que o worker em
container alcance o PostgreSQL que está publicado no Mac.

Para aplicar migrations em um banco local descartável de desenvolvimento:

```sh
npm run db:migrate
```

Em produção, use somente migrations revisadas com `prisma migrate deploy`. Nunca use `prisma migrate reset` nem `prisma db push`.

Crie ou atualize o administrador:

```sh
npm run admin:upsert --workspace=@achadinhos/database
```

Depois, inicie separadamente:

```sh
npm run dev:web
npm run dev:worker
```

## 7. Variáveis essenciais

| Área | Variáveis |
|---|---|
| Banco | `DATABASE_URL` |
| Aplicação | `APP_URL`, `APP_ENCRYPTION_KEY`, `APP_HEALTH_TOKEN` |
| Administrador | `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_INITIAL_PASSWORD` |
| Shopee | `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`, `SHOPEE_AFFILIATE_ID`, `SHOPEE_API_BASE_URL` |
| Worker | `WORKER_HEALTH_TOKEN`, `WORKER_API_TOKEN`, `WORKER_API_URL` |
| WhatsApp | `WHATSAPP_ENABLED`, `WHATSAPP_SESSION_DIR`, `WHATSAPP_ALLOWED_GROUP_ID` |
| Segurança de envio | `DEMO_MODE`, `PROVIDER_MODE`, `MOCK_PROVIDERS`, `SEND_LIVE` |

Tokens de saúde e controle devem ser distintos e ter pelo menos 24 caracteres. Valores reais pertencem ao secret manager do ambiente, nunca ao código, documentação, logs ou comandos compartilhados.

## 8. Travas de envio

O padrão seguro é:

```text
DEMO_MODE=true
PROVIDER_MODE=mock
MOCK_PROVIDERS=true
SEND_LIVE=false
```

O worker só aceita uma configuração real quando todas as condições abaixo são satisfeitas:

```text
DEMO_MODE=false
PROVIDER_MODE=live
MOCK_PROVIDERS=false
SEND_LIVE=true
```

Também é obrigatório habilitar e configurar pelo menos um provider. Uma combinação parcial ou contraditória impede o worker de iniciar. Os testes não possuem caminho para envio real.

## 9. Shopee

O navegador envia somente o link informado pelo administrador. O servidor:

1. valida protocolo, host, redirects, tamanho e tempo;
2. extrai os identificadores do produto e da loja;
3. assina o payload GraphQL com a credencial do servidor;
4. consulta a API oficial;
5. solicita o link curto de afiliado;
6. combina os dados com metadados públicos quando necessário;
7. informa quando o produto precisa de revisão manual.

A oferta rápida só entra na fila quando a resposta confirma o link afiliado.

## 10. WhatsApp

O conector WhatsApp roda exclusivamente no worker permanente. A sessão fica em `WHATSAPP_SESSION_DIR`, que deve apontar para um volume persistente e privado.

Durante a homologação:

1. mantenha `SEND_LIVE=false`;
2. configure os tokens privados da web e do worker;
3. habilite a conexão WhatsApp no host do worker;
4. abra **Grupos** no dashboard;
5. gere e escaneie o QR;
6. escolha exatamente um grupo;
7. confirme nome e identificador antes de qualquer futura ativação.

O cliente utilizado é não oficial e pode sofrer desconexões ou bloqueios. A sessão não deve ser executada em uma Function da Vercel.

## 11. Worker em homologação

Valide o Compose sem imprimir a configuração resolvida:

```sh
docker compose -f compose.worker.homologation.yaml config --quiet
```

No host revisado:

```sh
docker compose -f compose.worker.homologation.yaml up -d --build
```

Esse perfil fixa `DEMO_MODE=true`, `PROVIDER_MODE=mock`, `MOCK_PROVIDERS=true` e `SEND_LIVE=false`. Ele pode manter uma sessão WhatsApp, mas toda publicação continua mock.

Não execute `docker compose down -v`: o volume contém a sessão persistente do WhatsApp.

## 12. Saúde e observabilidade

- Web: `GET /api/health`, protegido por `APP_HEALTH_TOKEN`.
- Worker: `GET /health`, protegido por `WORKER_HEALTH_TOKEN`.

O worker só retorna `200` após completar um ciclo com o PostgreSQL. Banco inacessível, falha de persistência ou heartbeat atrasado retornam `503`.

Logs são estruturados e não incluem credenciais, destinos, corpo das mensagens, cookies, arquivos de sessão ou cabeçalhos de autorização.

## 13. Validação

Antes de iniciar a homologação, carregue as variáveis pelo mecanismo seguro do
ambiente e execute:

```sh
npm run preflight:homologation
```

O preflight verifica os nomes e formatos necessários, as quatro travas mock,
tokens distintos, endpoint oficial da Shopee, migrations e arquivos
operacionais. Em `DEMO_MODE=true`, `PROVIDER_MODE=mock`,
`MOCK_PROVIDERS=true` e `SEND_LIVE=false`, as credenciais da Shopee ficam
opcionais porque nenhum provider externo é chamado. Elas passam a ser
obrigatórias assim que o modo real é selecionado. O preflight carrega o `.env`
local quando presente, rejeita os placeholders do `.env.example` e não testa
nem imprime valores secretos.

Antes de uma entrega:

```sh
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Testes externos devem usar adapters mock. Um teste real exige autorização operacional separada e destino dedicado.

## 14. Publicação e recuperação

Antes de publicar uma nova versão:

1. pause as filas;
2. aguarde o ciclo atual;
3. crie e valide um backup restaurável;
4. revise e aplique migrations versionadas;
5. inicie web e worker em modo mock;
6. confira os dois health checks;
7. processe uma entrega fictícia;
8. só então avalie a ativação real separadamente.

Em incidentes, restaure imediatamente o modo mock, pause filas, pare o worker, preserve logs e IDs de idempotência e rotacione credenciais expostas. Prefira migrations de correção para frente; não apague histórico.

## 15. Documentos relacionados

- [Arquitetura](architecture.md)
- [Segurança](SECURITY.md)
- [Operações](OPERATIONS.md)
- [Implantação](DEPLOYMENT.md)
- [Plano de implementação](IMPLEMENTATION_PLAN.md)
