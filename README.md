# Sistema de Gestão para Oficina Mecânica

> API RESTful para gerenciamento de ordens de serviço, clientes, veículos e estoque de peças.

English version: [README-en.md](./README-en.md)

## Objetivo do Projeto

Backend para **gestão integrada de oficina mecânica**, desenvolvido como Tech Challenge da pós-graduação em Arquitetura de Software (15SOAT - FIAP). A arquitetura combina Clean Architecture e DDD.

### Problema que Resolve

- **Centralização**: substitui planilhas e processos manuais por um sistema único.
- **Rastreamento**: permite acompanhar o status da ordem de serviço em tempo real.
- **Controle de estoque**: gerencia peças, estoque mínimo e pedidos a fornecedores.
- **Validação**: aplica regras para CPF/CNPJ e placas veiculares brasileiras.

### Funcionalidades Principais

| Módulo | Descrição |
| ------ | --------- |
| **Ordens de Serviço** | Ciclo completo da OS, do recebimento até a entrega. |
| **Clientes** | CRUD com validação de CPF/CNPJ. |
| **Veículos** | CRUD com validação de placa brasileira. |
| **Serviços** | Catálogo de serviços oferecidos pela oficina. |
| **Peças e Insumos** | CRUD com controle de estoque e pedidos a fornecedores. |
| **Pagamentos** | Cobrança via Mercado Pago (Checkout Pro) na aprovação do orçamento, confirmada por webhook; registro manual de pagamento com disparo da entrega. |
| **Autenticação** | JWT com papéis `ADMIN`, `RECEPCIONISTA` e `MECANICO`. |

---

## Tecnologias

| Camada | Tecnologia |
| ------ | ---------- |
| Framework | NestJS 10.x |
| Linguagem | TypeScript 5.x |
| Banco de dados | PostgreSQL local; RDS na AWS |
| ORM | Prisma |
| Autenticação | JWT + bcrypt |
| Documentação | Swagger / OpenAPI |
| Container | Docker Compose |
| Testes | Jest |
| Segurança DAST | OWASP ZAP |
| IaC | Terraform 1.6+ |
| Orquestração | Kubernetes com kind |

Usamos Node.js com NestJS pela arquitetura modular e pela injeção de dependência nativa, PostgreSQL pela consistência transacional, e Prisma pela tipagem forte integrada ao TypeScript.

---

## Escalabilidade e Automação de Infraestrutura

### Orquestração AWS entre repositórios

Este repositório contém a aplicação, mas a stack AWS é distribuída em quatro repositórios: `repo-k8s-infra` (EKS/VPC), `repo-db-infra` (RDS), `async-furious-project` (imagem e workloads Kubernetes) e `repo-auth-serverless` (Lambda, API Gateway e authorizer). Para evitar dependências quebradas, a subida segue `K8s -> DB -> Auth -> App`; a destruição segue a ordem inversa: `App -> Auth -> DB -> K8s`.

O script `scripts/orchestrate-stack.py` usa Python 3 e somente o `gh`, para no primeiro erro e aguarda cada workflow. Requer Python 3 e o GitHub CLI (`gh`) instalado e autenticado (`gh auth login`):

```bash
pnpm aws:apply
pnpm aws:apply --environment prod
pnpm aws:destroy --confirmation "DESTROY HML"
pnpm aws:destroy --environment prod --confirmation "DESTROY PROD"
pnpm aws:destroy --what-if --confirmation "DESTROY HML"
```

O repositório usa pnpm, que repassa os argumentos direto para o script: não use `--` antes deles, ou o próprio `--` chega ao `argparse` e o comando falha com `unrecognized arguments`. Prefira `--environment prod` a `--prod`: os dois são equivalentes no script, mas `--prod` também é flag do pnpm e pode ser consumida antes de chegar lá.

Sem `--environment prod`, o ambiente padrão é HML. Combinar `--prod` com `--environment hml` é rejeitado. `apply` executa k8s `ci.yml`/`apply`, banco `ci.yml`/`apply`, app `deploy-eks.yml` e auth `ci.yml`/`apply`. `destroy` executa app `cleanup-eks.yml`, auth `down.yml`, banco `down.yml` e k8s `down.yml`. Todos usam a ref `main`, `academy_mode/aws_academy=false` e as credenciais AWS normais configuradas como secrets nos repositórios. O script nunca recebe secrets, não chama AWS diretamente e exige `gh auth login`.

Use `--what-if` antes de uma operação destrutiva para conferir a sequência. O `destroy` exige a confirmação exata do ambiente (`DESTROY HML` ou `DESTROY PROD`). O script dispara e monitora as GitHub Actions; ele não substitui os workflows nem executa `terraform` localmente.

Com o aumento da demanda e a expansão para novas unidades, a oficina precisa garantir alta disponibilidade do sistema mesmo em picos de atendimento. Para isso, a infraestrutura evoluiu com:

- **Infraestrutura escalável**: cluster Kubernetes com Horizontal Pod Autoscaler (2 a 5 réplicas, escalando por CPU > 70% ou memória > 80%).
- **Provisionamento automatizado**: Terraform cria o cluster (kind local, com caminho de migração documentado para EKS) e aplica todos os manifests Kubernetes via provider `kubectl`.
- **Pipeline de CI/CD**: GitHub Actions valida build, testes automatizados e infraestrutura (`terraform validate` + `plan`) a cada Pull Request.
- **Qualidade e organização do código**: Clean Architecture + DDD, com cobertura mínima de testes de 80%.

### Diagrama de Arquitetura

O diagrama-mestre da arquitetura (três microsserviços, Kafka, bancos, borda com API Gateway e Lambda Authorizer e Mercado Pago) mora em um único lugar: [`docs/architecture/overview.md`](./docs/architecture/overview.md). Este README não mantém cópia dele. A topologia de implantação está em [`docs/architecture/deployment-diagram.md`](./docs/architecture/deployment-diagram.md) e o fluxo da Saga em [`docs/architecture/saga-flow.md`](./docs/architecture/saga-flow.md).

### Fluxo de Deploy

1. A imagem Docker da API é construída localmente e carregada no cluster kind (`kind load docker-image`).
2. O PostgreSQL local é usado apenas no Docker Compose. HML/PROD recebem o ARN de um secret RDS com `host`, `port`, `dbname`, `username` e `password`; a aplicação consome esse contrato explícito.
3. A pipeline executa um Job controlado com `prisma migrate deploy`; migrations não rodam no startup dos pods.
4. O HPA escala os pods da API de 2 a 5 réplicas conforme o consumo de CPU/memória.
5. Em Pull Requests que alteram `infra/**` ou `k8s/**`, o GitHub Actions roda `terraform validate` + `terraform plan` e publica o plano como artifact para revisão humana antes de qualquer `apply` real.

Detalhes de execução (scripts, comandos manuais, troubleshooting) estão na seção [Infraestrutura como Código](#infraestrutura-como-código-terraform--kubernetes).

---

## Pré-requisitos

- Python 3 (para o orquestrador de stack)
- GitHub CLI (`gh`), autenticado com `gh auth login` (para o orquestrador de stack)
- Node.js 22
- pnpm (`npm install -g pnpm`)
- Docker e Docker Compose
- Terraform 1.6+
- kind (`go install sigs.k8s.io/kind@latest` ou instalação via gerenciador de pacotes)

---

## Como Executar Localmente

### 1. Clonar o repositório

```bash
git clone <repo-url>
cd async-furious-project
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workshop"
JWT_SECRET="change-me-in-production-use-openssl-rand-hex-32"
PORT=3000
BCRYPT_SALT_ROUNDS=10
ALLOWED_ORIGINS=http://localhost:3000
SEED_ADMIN_EMAIL="admin@oficina.com"
SEED_ADMIN_PASSWORD="changeme123"
# Mercado Pago (Checkout Pro) — credenciais da aba "Teste" do Painel do Desenvolvedor
MP_ACCESS_TOKEN=""
MP_WEBHOOK_SECRET=""      # Webhooks → Configurar notificação → chave secreta
MP_NOTIFICATION_URL=""    # opcional: URL pública do webhook, enviada em cada preference
```

Sem `MP_ACCESS_TOKEN`, aprovar um orçamento falha; sem `MP_WEBHOOK_SECRET`, o webhook do Mercado Pago recusa toda notificação com `401`.

### 3. Iniciar com Docker para desenvolvimento

```bash
# Sobe somente o PostgreSQL
docker compose -f docker-compose.dependencies.yml up -d

# Roda migrations, seed e aplicacao em modo watch
pnpm run dev
```

### 4. Ou iniciar a stack completa

```bash
# Sobe PostgreSQL + aplicacao
docker compose up -d
```

A aplicação fica disponível em `http://localhost:3000`.

Em HML/PROD, o fluxo é `API Gateway -> CPF Auth Lambda (RS256) -> Authorizer -> monolito privado`. O monolito não é exposto diretamente; seus pods usam o `DATABASE_URL` do RDS. `GET /api/v1/health/live` verifica o processo e `GET /api/v1/health/ready` verifica o banco.

---

## Documentação da API

Depois de iniciar o projeto, acesse o Swagger em:

```text
http://localhost:3000/api/docs
```

O Swagger descreve só o OS Service (título `Async Furious - OS Service`). O esquema `bearer` (JWT) vale para todas as rotas, exceto as públicas (`/status`, `auth/login` e `health`), e o esquema `webhook-secret` (header `x-webhook-secret`) documenta o webhook de status. Evidência: o export do OpenAPI fica versionado em [`docs/http/openapi/os-service.openapi.json`](docs/http/openapi/os-service.openapi.json) e é regenerado com `pnpm docs:openapi` (não sobe o servidor nem conecta no banco).

### Superfície HTTP do OS Service (#332)

- **Sem REST entre serviços.** Nenhuma rota deste serviço é consumida por Billing ou Execução; tudo o que eles precisam chega por evento ([`saga-flow.md`](docs/architecture/saga-flow.md)).
- **Única rota pública:** `GET /api/v1/ordens-servico/{id}/status`, sem Bearer, com resposta mínima (`ordemServicoId` e `status`, sem dados do cliente). Qualquer outra rota sem token responde `401`.
- **Removidas, sem proxy:** `GET /ordens-servico/:id/rastreamento` (alias de `/status`) e `POST /ordens-servico/:id/aprovar-servico` (aprovação pública duplicada do orçamento) respondem `404`. `PATCH /ordens-servico/:id/aprovar-servico` continua, autenticada.
- **RBAC inalterado:** `JwtAuthGuard` e `RolesGuard` seguem validando o token localmente, como segunda camada depois do Lambda Authorizer da borda (ADR-0021).
- **Webhook de status como exceção:** `POST /webhooks/service-orders/status` é um canal de reprocesso manual (JWT + `x-webhook-secret`). A transição é validada pelo mesmo `StatusTransitionService` dos consumidores de evento, e `DELIVERED` é rejeitado com `400`: a entrega só acontece por `registrar-entrega`.
- **Versionamento:** o prefixo continua `api/v1`. Durante a Fase 4 quebras de contrato são aceitas dentro de `v1`, sem `v2` em paralelo: todos os consumidores nascem nesta fase e não há cliente externo a preservar. Cada quebra é registrada nesta seção e na ADR correspondente.
- **Pendências de outras features:** `pagamentos`, as rotas de aprovação/recusa de orçamento e o campo `orcamento` na resposta da OS saem do serviço na extração do financeiro (#330); a leitura de `/status`, `GET /ordens-servico/:id` e `GET /clientes/:id` pelo read model em DocumentDB vem com a #335.

A coleção completa das APIs (formato Insomnia v5) fica versionada no repositório e pode ser importada diretamente pelo link:

[docs/http/insomnia.yaml](https://github.com/Async-And-Furious/async-furious-project/blob/develop/docs/http/insomnia.yaml)

Para importar no Insomnia: `Application Menu > Preferences > Data > Import Data`, escolhendo `From File` (após baixar o arquivo) ou `From URL` (colando o link acima).

### Rotas

#### Autenticação (`/api/v1/auth`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/auth/register` | ADMIN | Registrar novo usuário. |
| POST | `/auth/login` | Público | Fazer login e retornar JWT. |

#### Clientes (`/api/v1/clientes`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/clientes` | RECEPCIONISTA | Criar cliente. |
| GET | `/clientes` | Autenticado | Listar clientes. |
| GET | `/clientes/:id` | Autenticado | Detalhar cliente. |
| PATCH | `/clientes/:id` | RECEPCIONISTA | Atualizar cliente. |
| DELETE | `/clientes/:id` | ADMIN | Deletar cliente. |

#### Veículos (`/api/v1/veiculos`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/veiculos` | RECEPCIONISTA | Criar veículo. |
| GET | `/veiculos` | Autenticado | Listar veículos. |
| GET | `/veiculos/:id` | Autenticado | Detalhar veículo. |
| PATCH | `/veiculos/:id` | RECEPCIONISTA | Atualizar veículo. |
| DELETE | `/veiculos/:id` | ADMIN | Deletar veículo. |

#### Serviços (`/api/v1/servicos`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/servicos` | ADMIN | Criar serviço. |
| GET | `/servicos` | Autenticado | Listar serviços. |
| GET | `/servicos/:id` | Autenticado | Detalhar serviço. |
| PATCH | `/servicos/:id` | ADMIN | Atualizar serviço. |
| DELETE | `/servicos/:id` | ADMIN | Deletar serviço. |

#### Ordens de Serviço (`/api/v1/ordens-servico`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/ordens-servico` | RECEPCIONISTA | Criar OS. |
| GET | `/ordens-servico` | Autenticado | Listar OSs. |
| GET | `/ordens-servico/:id` | Autenticado | Detalhar OS. |
| GET | `/ordens-servico/:id/status` | Público | Consultar status da OS (resposta mínima, sem dados do cliente). |
| PATCH | `/ordens-servico/:id` | ADMIN | Atualizar OS. |
| DELETE | `/ordens-servico/:id` | ADMIN | Deletar OS. |
| PATCH | `/ordens-servico/:id/assumir` | MECANICO | Mecânico assume a OS. (deprecated) |
| PATCH | `/ordens-servico/:id/analisar` | MECANICO | Registrar análise diagnóstica. (deprecated) |
| PATCH | `/ordens-servico/:id/servicos-insumos` | MECANICO | Gerar orçamento. |
| PATCH | `/ordens-servico/:id/orcamento/aprovar` | Público | Cliente aprova orçamento; a resposta traz `linkPagamento` (Checkout Pro do Mercado Pago). `502` se o Mercado Pago falhar (orçamento segue pendente). |
| PATCH | `/ordens-servico/:id/orcamento/recusar` | Público | Cliente recusa orçamento. |
| PATCH | `/ordens-servico/:id/aprovar-servico` | Autenticado | Aprovar o serviço prestado (OS segue Finalizada). |
| PATCH | `/ordens-servico/:id/finalizar-execucao` | MECANICO | Mecânico finaliza execução. (deprecated) |
| PATCH | `/ordens-servico/:id/registrar-entrega` | RECEPCIONISTA | Registrar entrega. |
| GET | `/ordens-servico/tempo-medio` | ADMIN | Consultar tempo médio de execução. |

> **Deprecated (#334):** `assumir` migra para `PATCH /execucoes/:id/iniciar-diagnostico`, que também absorve `analisar` (sem rota equivalente), e `finalizar-execucao` migra para `PATCH /execucoes/:id/concluir`, no serviço de Execução e Produção. Nas rotas novas, o `:id` é o da Execução (listar em `GET /execucoes`), não o da OS. As três continuam funcionando até o fluxo do mecânico funcionar de ponta a ponta em HML pelo Execução, incluindo o transporte dos eventos entre os serviços; depois são removidas.

#### Peças e Insumos (`/api/v1/pecas`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/pecas` | ADMIN | Criar peça ou insumo. |
| GET | `/pecas` | Autenticado | Listar peças e insumos. |
| GET | `/pecas/:id` | Autenticado | Detalhar peça ou insumo. |
| PATCH | `/pecas/:id` | ADMIN | Atualizar peça ou insumo. |
| PATCH | `/pecas/:id/estoque` | ADMIN | Atualizar estoque. |
| DELETE | `/pecas/:id` | ADMIN | Deletar peça ou insumo. |
| POST | `/pecas/fornecedor/solicitar` | ADMIN | Solicitar peças a fornecedor. |
| PATCH | `/pecas/fornecedor/pedidos/:pedidoId/receber` | ADMIN | Confirmar recebimento de peças. |

#### Pagamentos (`/api/v1/pagamentos`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/pagamentos/registrar` | Autenticado | Disparar a entrega da OS cujo pagamento já foi confirmado pelo Mercado Pago (`409` se não houver). Não cria nem marca pagamento. |

#### Webhook de status da OS (`/api/v1/webhooks/service-orders`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/webhooks/service-orders/status` | Autenticado + `x-webhook-secret` | Reprocesso manual do status da OS pela máquina de estados. `DELIVERED` é rejeitado (`400`). |

#### Webhook do Mercado Pago (`/api/v1/webhooks/mercado-pago`)

| Método | Endpoint | Acesso | Descrição |
| ------ | -------- | ------ | --------- |
| POST | `/webhooks/mercado-pago` | Público (assinatura `x-signature`) | Notificação de pagamento: reconsulta o Mercado Pago; aprovado → `CONFIRMADO`, recusado → `RECUSADO`. Reentregas não têm efeito. |

---

## Ciclo de Vida da Ordem de Serviço

```text
RECEIVED
  -> UNDER_DIAGNOSIS
      -> AWAITING_APPROVAL
          -> CLOSED_WITHOUT_EXECUTION  (orcamento recusado)
          -> IN_PROGRESS
              -> AWAITING_PARTS  (pecas indisponiveis)
                  -> IN_PROGRESS  (pecas reservadas)
              -> FINISHED
                  -> DELIVERED
```

---

## Fase 4 — Transação Distribuída (Saga)

A partir da Fase 4, este monólito é refatorado em três microsserviços
independentes — **OS Service** (este repositório), **Billing Service** e
**Execução e Produção** — e o fluxo acima passa a atravessar fronteiras de
serviço via eventos assíncronos (Kafka).

**Estratégia escolhida: Saga coreografada.** Não existe orquestrador
central nem um serviço/repositório coordenador — cada serviço publica os
eventos de sua própria fronteira e reage aos eventos dos outros dois,
executando a própria compensação quando algo falha. Consideramos e
recusamos um orquestrador central com repositório próprio (custo de
infraestrutura e de ponto único de falha não compensado pelo requisito, que
trata orquestração e coreografia como opções equivalentes) e um
orquestrador embutido no OS Service sem repositório separado (acoplaria os
outros dois serviços a decisões tomadas por este).

O fluxo coberto pela saga é `Abrir OS → orçamento → aprovação → pagamento →
execução iniciada` — o pagamento acontece logo após a aprovação do
orçamento e **antes** do início da execução, como etapa obrigatória para
que o Billing Service participe da transação distribuída. A entrega fica
fora do escopo da saga por ser um ato presencial, sem contrapartida
assíncrona a coordenar; a checagem de "pagamento confirmado" feita antes de
`registrar-entrega` é uma trava de segurança sobre esse mesmo pagamento —
não uma segunda cobrança. Compensação é lógica por padrão (reverter status
da OS, encerrar orçamento sem execução); o estorno real no Mercado Pago só
é acionado se o pagamento já tiver sido capturado antes da falha.

Sem orquestrador, não há um "estado único da saga" — a rastreabilidade do
fluxo distribuído combina trace no New Relic, o `correlationId` propagado
no envelope de evento e o `HistoricoStatusOS.motivo` já existente no banco.

Detalhamento completo (diagrama de sequência, mapa de responsabilidade por
etapa e matriz `etapa → falha → compensação`):
[ADR-0016](./docs/adr/0016-saga-coreografada.md) e
[`docs/architecture/saga-flow.md`](./docs/architecture/saga-flow.md).

---

## Autenticação e Papéis

Todos os endpoints, exceto os marcados com `@Public()`, exigem o header `Authorization: Bearer <token>`.

| Papel | Permissões principais |
| ----- | --------------------- |
| `ADMIN` | Acesso total: CRUD de serviços, peças e gestão administrativa. |
| `RECEPCIONISTA` | Cria e atualiza clientes/veículos, cria OS e registra entrega. |
| `MECANICO` | Assume OS, diagnostica, gera orçamento e finaliza execução. |

O token JWT expira em **1 hora**.

---

## Testes

```bash
# Todos os testes unitarios
pnpm test

# Relatorio de cobertura
pnpm test:cov

# Modo watch
pnpm test:watch

# Testes E2E
pnpm test:e2e

# Arquivo especifico
pnpm test -- test/cadastro/use-cases/cliente.use-cases.spec.ts

# Por nome do teste
pnpm test -- --testNamePattern="CreateClienteUseCase"
```

### Thresholds de Cobertura

| Métrica | Mínimo |
| ------- | ------ |
| Statements | 80% |
| Lines | 80% |
| Functions | 80% |
| Branches | 80% |

O mínimo de 80% vale para as quatro métricas e é exigido pelo `pnpm test:cov` (`jest.config.js`) e pelo job `Run All Tests` do workflow `tests.yml`, que falha se o mínimo não for atingido. A evidência de cada execução do CI é o artifact `coverage` do run (aba Actions, retenção de 7 dias), que traz o relatório `lcov` e a versão HTML. Consulte [as execuções do workflow de testes](https://github.com/Async-And-Furious/async-furious-project/actions/workflows/tests.yml) para abrir o artifact de cada run. O job `sonar` analisa o mesmo relatório no SonarCloud. Ver [ADR-0014](docs/adr/0014-cobertura-minima-testes.md).

---

## Estrutura do Projeto

```text
src/
├── auth/                    # JWT, guards, estrategias, decorators
├── modules/
│   ├── cadastro/            # Clientes, Veiculos, Servicos
│   │   ├── domain/          # Entidades, VOs, interfaces de repositorio
│   │   ├── application/     # Use cases
│   │   ├── infrastructure/  # Repositorios Prisma
│   │   └── presentation/    # Controllers, DTOs
│   ├── ordem-servico/       # Ordens de Servico + Orcamentos
│   ├── pecas-insumos/       # Pecas, estoque, pedidos a fornecedores
│   └── financeiro/          # Pagamentos
└── shared/
    ├── domain/              # DomainEvent base, excecoes, interfaces
    └── infrastructure/      # PrismaService, EmissorEventos, filtros
```

Cada módulo segue a regra de dependência: `presentation -> application -> domain <- infrastructure`.

---

## Comandos Úteis

```bash
# Desenvolvimento com PostgreSQL, migrations, seed e app
pnpm run dev

# Build de producao
pnpm run build

# Executar build de producao
pnpm run prod

# Lint com auto-fix
pnpm run lint

# Formatar codigo
pnpm run format
```

---

## Infraestrutura como Código (Terraform + Kubernetes)

A infraestrutura local é provisionada com Terraform em um cluster Kubernetes local criado pelo kind.

### Pré-requisitos

- Docker rodando
- `terraform` 1.6+
- `kind`
- `kubectl`

### Estrutura

```text
/infra
  versions.tf                        # Versoes dos providers
  /modules/kind-cluster              # Cria cluster kind com control-plane e worker
  /modules/kubernetes-apps           # Aplica manifests via kubectl provider
  /environments/local                # Ambiente local
  /environments/aws/README.md        # Stub para migracao EKS

/k8s
  namespace.yaml
  /config    configmap.yaml, secret.yaml
  /app       deployment.yaml, service.yaml, target-group-binding.yaml, hpa.yaml
  /database  statefulset.yaml, service.yaml, pvc.yaml
```

### Subir o ambiente local (script automatizado)

Use o script `scripts/local-up.sh` — ele executa todos os passos na ordem correta:

```bash
# Provisiona tudo: build da imagem, cluster kind, Terraform apply,
# carrega imagem nos nos, aguarda PostgreSQL local, roda migrations Prisma e smoke test
./scripts/local-up.sh up

# Rebuild da imagem + reload no cluster (sem recriar infra)
./scripts/local-up.sh reload

# Destroi o ambiente
./scripts/local-up.sh down
```

As variáveis `TF_VAR_db_password`, `TF_VAR_jwt_secret`, `TF_VAR_seed_admin_email`
e `TF_VAR_seed_admin_password` podem ser exportadas antes ou definidas em
`.env.local` — o script solicita interativamente se não encontrar.

No deploy EKS, as variáveis `JWT_ISSUER` e `JWT_AUDIENCE` são obrigatórias no
Environment. O `TARGET_GROUP_ARN` é resolvido, sem fallback, do output
`application_target_group_arn` (ou `internal_alb_target_group_arn`) do state
remoto atual de `repo-k8s-infra` para o ambiente correspondente; o deploy e os
smokes falham se o state não puder ser lido ou o ARN for inválido. Os outputs atuais de `repo-db-infra` são lidos
do state remoto por ambiente (`db_connection_secret_arn`, `db_host`, `db_port`,
`db_name` e `db_ssl_mode`); portanto, não configure um ARN RDS estático no
GitHub. O secret RDS é lido em runtime e seus valores não são impressos.

### Subir o ambiente local (manual)

Execute os comandos a partir da raiz do repositório, exceto quando indicado.

```bash
# 1. Build da imagem local da API
docker build -t async-furious-api:latest .

# 2. Variaveis sensiveis usadas pelo Terraform
export TF_VAR_db_password="postgres"
export TF_VAR_jwt_secret="change-me-in-production-use-openssl-rand-hex-32"
export TF_VAR_seed_admin_email="admin@oficina.com"
export TF_VAR_seed_admin_password="changeme123"

# 3. Criar cluster e aplicar os manifests
cd infra/environments/local
terraform init
terraform apply

# 4. Carregar imagem nos nos do kind (necessario por imagePullPolicy: Never)
kind load docker-image async-furious-api:latest --name async-furious

# 5. Recriar pods da API
kubectl rollout restart deployment/async-furious-api -n async-furious
```

### Acompanhar o deploy

```bash
kubectl get pods -n async-furious -w
kubectl rollout status deployment/async-furious-api -n async-furious --timeout=240s
kubectl get events -n async-furious --sort-by=.lastTimestamp -w
```

Se a API quebrar durante o bootstrap:

```bash
kubectl logs -n async-furious -l app=async-furious-api --previous --tail=100
kubectl describe pod -n async-furious -l app=async-furious-api
```

A API deve responder no endpoint de status publicado em `/api/v1`:

```bash
curl http://localhost:30000/api/v1
```

Para destruir o ambiente local:

```bash
cd infra/environments/local
terraform destroy
# ou: ./scripts/local-up.sh down
```

### Rebuild e redeploy da API

```bash
# Via script (recomendado)
./scripts/local-up.sh reload

# Manual
docker build -t async-furious-api:latest .
kind load docker-image async-furious-api:latest --name async-furious
kubectl rollout restart deployment/async-furious-api -n async-furious
kubectl rollout status deployment/async-furious-api -n async-furious --timeout=240s
curl http://localhost:30000/api/v1
```

### Observações importantes

- Os probes do Kubernetes devem apontar para `/api/v1`, não para `/health`.
- Se aparecer `ErrImageNeverPull`, carregue a imagem com `kind load docker-image` ou use `./scripts/local-up.sh reload`.
- O init container `migrate` roda `prisma migrate deploy` antes de cada pod da API iniciar.
- O HPA requer o metrics-server, que é instalado automaticamente pelo módulo `kubernetes-apps`.
- Se aparecer erro de autenticação do Prisma contra `postgres-service`, confira se `TF_VAR_db_password` e o password do PostgreSQL local existente são iguais. Em ambiente local descartável, destruir e recriar o cluster/volume também resolve.

### CI/CD

Pull requests que alterem `infra/**` ou `k8s/**` executam automaticamente `terraform validate` e `terraform plan` via `.github/workflows/terraform.yml` (rápido, nenhum cluster é criado).

Em push para `main`/`develop` (ou via `workflow_dispatch` manual), o mesmo workflow roda um segundo job que aplica a infraestrutura de verdade: builda a imagem Docker, provisiona um cluster `kind` efêmero com `terraform apply`, implanta a aplicação e roda um smoke test em `/api/v1`. A limpeza permanece manual e somente para HML. Isso roda inteiramente dentro do runner do GitHub usando Docker — nenhuma conta de nuvem é envolvida. O job reutiliza o `scripts/local-up.sh`, o mesmo script usado no provisionamento local.

### Migração para EKS

Consulte `infra/environments/aws/README.md`.

---

## Persistência e Modelo de Dados

A documentação completa da camada de persistência (diagrama ER, modelo relacional tabela a tabela, mapeamento entre entidades de domínio e tabelas, justificativas do PostgreSQL e do Prisma, estratégia de persistência e o histórico de decisões de evolução do schema) está em [docs/infrastructure/database.md](./docs/infrastructure/database.md).

---

## Convenções de Código

Consulte [AGENTS.md](./AGENTS.md) para convenções de nomenclatura, padrões TypeScript/NestJS e políticas de imports.

---

## Licença

Privado - Todos os direitos reservados.
