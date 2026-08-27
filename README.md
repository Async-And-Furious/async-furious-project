# Sistema de Gestao para Oficina Mecanica

> API RESTful para gerenciamento de ordens de servico, clientes, veiculos e estoque de pecas.

English version: [README-en.md](./README-en.md)

## Objetivo do Projeto

Backend para **gestao integrada de oficina mecanica**, desenvolvido como Tech Challenge da pos-graduacao em Arquitetura de Software (15SOAT - FIAP). A arquitetura combina Clean Architecture e DDD.

### Problema que Resolve

- **Centralizacao**: substitui planilhas e processos manuais por um sistema unico.
- **Rastreamento**: permite acompanhar o status da ordem de servico em tempo real.
- **Controle de estoque**: gerencia pecas, estoque minimo e pedidos a fornecedores.
- **Validacao**: aplica regras para CPF/CNPJ e placas veiculares brasileiras.

### Funcionalidades Principais

| Modulo | Descricao |
| ------ | --------- |
| **Ordens de Servico** | Ciclo completo da OS, do recebimento ate a entrega. |
| **Clientes** | CRUD com validacao de CPF/CNPJ. |
| **Veiculos** | CRUD com validacao de placa brasileira. |
| **Servicos** | Catalogo de servicos oferecidos pela oficina. |
| **Pecas e Insumos** | CRUD com controle de estoque e pedidos a fornecedores. |
| **Pagamentos** | Registro de pagamentos com disparo automatico da entrega. |
| **Autenticacao** | JWT com papeis `ADMIN`, `RECEPCIONISTA` e `MECANICO`. |

---

## Tecnologias

| Camada | Tecnologia |
| ------ | ---------- |
| Framework | NestJS 10.x |
| Linguagem | TypeScript 5.x |
| Banco de dados | PostgreSQL 15 |
| ORM | Prisma |
| Autenticacao | JWT + bcrypt |
| Documentacao | Swagger / OpenAPI |
| Container | Docker Compose |
| Testes | Jest |
| Seguranca DAST | OWASP ZAP |
| IaC | Terraform 1.6+ |
| Orquestracao | Kubernetes com kind |

Usamos Node.js com NestJS pela arquitetura modular e pela injecao de dependencia nativa, PostgreSQL pela consistencia transacional, e Prisma pela tipagem forte integrada ao TypeScript.

---

## Escalabilidade e Automacao de Infraestrutura

Com o aumento da demanda e a expansao para novas unidades, a oficina precisa garantir alta disponibilidade do sistema mesmo em picos de atendimento. Para isso, a infraestrutura evoluiu com:

- **Infraestrutura escalavel**: cluster Kubernetes com Horizontal Pod Autoscaler (2 a 5 replicas, escalando por CPU > 70% ou memoria > 80%).
- **Provisionamento automatizado**: Terraform cria o cluster (kind local, com caminho de migracao documentado para EKS) e aplica todos os manifests Kubernetes via provider `kubectl`.
- **Pipeline de CI/CD**: GitHub Actions valida build, testes automatizados e infraestrutura (`terraform validate` + `plan`) a cada Pull Request.
- **Qualidade e organizacao do codigo**: Clean Architecture + DDD, com cobertura minima de testes de 85%.

### Diagrama de Arquitetura

```mermaid
flowchart TB
    C[Cliente HTTP]

    subgraph CI["CI/CD - GitHub Actions"]
        T1["tests.yml<br/>build + testes automatizados"]
        T2["terraform.yml<br/>terraform validate + plan"]
    end

    subgraph IaC["Terraform (/infra)"]
        KC["modulo kind-cluster<br/>provisiona o cluster"]
        KA["modulo kubernetes-apps<br/>aplica manifests de /k8s"]
        KC --> KA
    end

    subgraph K8s["Cluster Kubernetes (kind local / EKS)"]
        direction TB
        SVC["Service NodePort<br/>:30000 -> :3000"]
        subgraph DEPLOY["Deployment async-furious-api<br/>2-5 pods via HPA"]
            API1[Pod API]
            API2[Pod API]
        end
        CM[ConfigMap]
        SEC[Secret]
        SVC --> DEPLOY
        CM -.env.-> DEPLOY
        SEC -.env.-> DEPLOY
        subgraph DB["StatefulSet postgres"]
            PG[("Postgres 15")]
        end
        PVC["PVC 1Gi"]
        PG --- PVC
        DEPLOY -->|Prisma| PG
    end

    C --> SVC
    T2 -.PR.-> IaC
    KA -->|kubectl_manifest| K8s
```

### Fluxo de Deploy (ClusterIP; EKS usa o ingress/load balancer aprovado)

1. A imagem Docker da API e construida localmente e carregada no cluster kind (`kind load docker-image`) ou publicada no ECR para o EKS.
2. Terraform (`infra/environments/local`) provisiona o cluster kind e aplica os manifests de `/k8s` — namespace, ConfigMap, Secret, StatefulSet do Postgres e Deployment/Service/HPA da API.
3. Execute o Job de migracao controlado uma vez por versao (`kubectl create -f k8s/app/migration-job.yaml`) antes do Deployment; os pods nao rodam migration ou seed.
4. O HPA escala os pods da API de 2 a 5 replicas conforme o consumo de CPU/memoria.
5. Em Pull Requests que alteram `infra/**` ou `k8s/**`, o GitHub Actions roda `terraform validate` + `terraform plan` e publica o plano como artifact para revisao humana antes de qualquer `apply` real.

Detalhes de execucao (scripts, comandos manuais, troubleshooting) estao na secao [Infraestrutura como Codigo](#infraestrutura-como-codigo-terraform--kubernetes).

---

## Pre-requisitos

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker e Docker Compose
- Terraform 1.6+
- kind (`go install sigs.k8s.io/kind@latest` ou instalacao via gerenciador de pacotes)

---

## Como Executar Localmente

### 1. Clonar o repositorio

```bash
git clone <repo-url>
cd async-furious-project
```

### 2. Configurar variaveis de ambiente

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
SEED_ADMIN_EMAIL="admin@example.invalid"
SEED_ADMIN_PASSWORD="replace-with-disposable-local-secret"
SEED_RECEPCIONISTA_PASSWORD="replace-with-disposable-local-secret"
SEED_MECANICO_PASSWORD="replace-with-disposable-local-secret"
```

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

A aplicacao fica disponivel em `http://localhost:3000`.

### JWT em producao

Em producao, o contrato compartilhado exige `RS256`, `JWT_PUBLIC_KEY`,
`JWT_ISSUER=repo-auth-serverless`, `JWT_AUDIENCE=async-furious-project` e
`JWT_EXPIRES_IN=1800`. O servico verifica tokens emitidos pelo autenticador
compartilhado; `JWT_PRIVATE_KEY` somente deve ser fornecida por um Secret
gerenciado quando este processo for explicitamente autorizado a assinar.
Sem ela, a assinatura local de producao falha fechada. Nunca versione chaves.

O exemplo local acima usa `HS256` e `JWT_SECRET` apenas para desenvolvimento e
testes; essa alternativa nao e aceita em producao.

---

## Documentacao da API

Depois de iniciar o projeto, acesse o Swagger em:

```text
http://localhost:3000/api/docs
```

A colecao completa das APIs (formato Insomnia v5) fica versionada no repositorio e pode ser importada diretamente pelo link:

[docs/http/insomnia.yaml](https://github.com/Async-And-Furious/async-furious-project/blob/develop/docs/http/insomnia.yaml)

Para importar no Insomnia: `Application Menu > Preferences > Data > Import Data`, escolhendo `From File` (apos baixar o arquivo) ou `From URL` (colando o link acima).

### Rotas

#### Autenticacao (`/api/v1/auth`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/auth/register` | ADMIN | Registrar novo usuario. |
| POST | `/auth/login` | Publico | Fazer login e retornar JWT. |

#### Clientes (`/api/v1/clientes`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/clientes` | RECEPCIONISTA | Criar cliente. |
| GET | `/clientes` | Autenticado | Listar clientes. |
| GET | `/clientes/:id` | Autenticado | Detalhar cliente. |
| PATCH | `/clientes/:id` | RECEPCIONISTA | Atualizar cliente. |
| DELETE | `/clientes/:id` | ADMIN | Deletar cliente. |

#### Veiculos (`/api/v1/veiculos`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/veiculos` | RECEPCIONISTA | Criar veiculo. |
| GET | `/veiculos` | Autenticado | Listar veiculos. |
| GET | `/veiculos/:id` | Autenticado | Detalhar veiculo. |
| PATCH | `/veiculos/:id` | RECEPCIONISTA | Atualizar veiculo. |
| DELETE | `/veiculos/:id` | ADMIN | Deletar veiculo. |

#### Servicos (`/api/v1/servicos`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/servicos` | ADMIN | Criar servico. |
| GET | `/servicos` | Autenticado | Listar servicos. |
| GET | `/servicos/:id` | Autenticado | Detalhar servico. |
| PATCH | `/servicos/:id` | ADMIN | Atualizar servico. |
| DELETE | `/servicos/:id` | ADMIN | Deletar servico. |

#### Ordens de Servico (`/api/v1/ordens-servico`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/ordens-servico` | RECEPCIONISTA | Criar OS. |
| GET | `/ordens-servico` | Autenticado | Listar OSs. |
| GET | `/ordens-servico/:id` | Autenticado | Detalhar OS. |
| GET | `/ordens-servico/:id/status` | Autenticado | Consultar status da OS. |
| PATCH | `/ordens-servico/:id` | ADMIN | Atualizar OS. |
| DELETE | `/ordens-servico/:id` | ADMIN | Deletar OS. |
| PATCH | `/ordens-servico/:id/assumir` | MECANICO | Mecanico assume a OS. |
| PATCH | `/ordens-servico/:id/analisar` | MECANICO | Registrar analise diagnostica. |
| PATCH | `/ordens-servico/:id/servicos-insumos` | MECANICO | Gerar orcamento. |
| PATCH | `/ordens-servico/:id/orcamento/aprovar` | Publico | Cliente aprova orcamento. |
| PATCH | `/ordens-servico/:id/orcamento/recusar` | Publico | Cliente recusa orcamento. |
| PATCH | `/ordens-servico/:id/aprovar-servico` | Publico | Cliente aprova servico prestado. |
| PATCH | `/ordens-servico/:id/finalizar-execucao` | MECANICO | Mecanico finaliza execucao. |
| PATCH | `/ordens-servico/:id/registrar-entrega` | RECEPCIONISTA | Registrar entrega. |
| GET | `/ordens-servico/tempo-medio` | ADMIN | Consultar tempo medio de execucao. |

#### Pecas e Insumos (`/api/v1/pecas`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/pecas` | ADMIN | Criar peca ou insumo. |
| GET | `/pecas` | Autenticado | Listar pecas e insumos. |
| GET | `/pecas/:id` | Autenticado | Detalhar peca ou insumo. |
| PATCH | `/pecas/:id` | ADMIN | Atualizar peca ou insumo. |
| PATCH | `/pecas/:id/estoque` | ADMIN | Atualizar estoque. |
| DELETE | `/pecas/:id` | ADMIN | Deletar peca ou insumo. |
| POST | `/pecas/fornecedor/solicitar` | ADMIN | Solicitar pecas a fornecedor. |
| PATCH | `/pecas/fornecedor/pedidos/:pedidoId/receber` | ADMIN | Confirmar recebimento de pecas. |

#### Pagamentos (`/api/v1/pagamentos`)

| Metodo | Endpoint | Acesso | Descricao |
| ------ | -------- | ------ | --------- |
| POST | `/pagamentos/registrar` | Autenticado | Registrar pagamento e disparar entrega da OS. |

---

## Ciclo de Vida da Ordem de Servico

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

## Autenticacao e Papeis

Todos os endpoints, exceto os marcados com `@Public()`, exigem o header `Authorization: Bearer <token>`.

| Papel | Permissoes principais |
| ----- | --------------------- |
| `ADMIN` | Acesso total: CRUD de servicos, pecas e gestao administrativa. |
| `RECEPCIONISTA` | Cria e atualiza clientes/veiculos, cria OS e registra entrega. |
| `MECANICO` | Assume OS, diagnostica, gera orcamento e finaliza execucao. |

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

| Metrica | Minimo |
| ------- | ------ |
| Statements | 85% |
| Lines | 85% |
| Functions | 80% |
| Branches | 80% |

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

Cada modulo segue a regra de dependencia: `presentation -> application -> domain <- infrastructure`.

---

## Comandos Uteis

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

## Infraestrutura como Codigo (Terraform + Kubernetes)

A infraestrutura local e provisionada com Terraform em um cluster Kubernetes local criado pelo kind.

### Pre-requisitos

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
  /environments/aws/README.md        # Deploy manual para EKS existente

/k8s
  namespace.yaml
  /config    configmap.yaml, secret.yaml
  /app       deployment.yaml, service.yaml, hpa.yaml
  /overlays/aws  # Ingress ALB interno e deploy EKS por digest
  /database  statefulset.yaml, service.yaml, pvc.yaml
```

### Subir o ambiente local (script automatizado)

Use o script `scripts/local-up.sh` — ele executa todos os passos na ordem correta:

```bash
# Provisiona tudo: build da imagem, cluster kind, Terraform apply,
# carrega imagem nos nos, aguarda Postgres, roda migrations Prisma e smoke test
./scripts/local-up.sh up

# Rebuild da imagem + reload no cluster (sem recriar infra)
./scripts/local-up.sh reload

# Destroi o ambiente
./scripts/local-up.sh down
```

As variaveis `TF_VAR_db_password`, `TF_VAR_jwt_secret`, `TF_VAR_seed_admin_email`,
`TF_VAR_seed_admin_password`, `TF_VAR_seed_recepcionista_password` e
`TF_VAR_seed_mecanico_password` podem ser exportadas antes ou definidas em
`.env.local` — o script solicita interativamente se nao encontrar.

### Subir o ambiente local (manual)

Execute os comandos a partir da raiz do repositorio, exceto quando indicado.

```bash
# 1. Build da imagem local da API
docker build -t async-furious-api:latest .

# 2. Variaveis sensiveis usadas pelo Terraform
export TF_VAR_db_password="postgres"
export TF_VAR_jwt_secret="change-me-in-production-use-openssl-rand-hex-32"
export TF_VAR_seed_admin_email="admin@example.invalid"
export TF_VAR_seed_admin_password="<disposable-local-secret>"
export TF_VAR_seed_recepcionista_password="<disposable-local-secret>"
export TF_VAR_seed_mecanico_password="<disposable-local-secret>"

# 3. Criar cluster e aplicar os manifests
cd infra/environments/local
terraform init
terraform apply

# 4. Carregar imagem nos nos do kind (necessario por imagePullPolicy: Never)
kind load docker-image async-furious-api:latest --name async-furious

# 5. Recriar pods da API
kubectl rollout restart deployment/async-furious-api -n async-furious
kubectl rollout status deployment/async-furious-api -n async-furious --timeout=240s
curl http://localhost:30000/api/v1/health/live
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

### Observacoes importantes

- Os probes do Kubernetes devem apontar para `/api/v1`, nao para `/health`.
- Se aparecer `ErrImageNeverPull`, carregue a imagem com `kind load docker-image` ou use `./scripts/local-up.sh reload`.
- O init container `migrate` roda `prisma migrate deploy` antes de cada pod da API iniciar.
- O HPA requer o metrics-server, que e instalado automaticamente pelo modulo `kubernetes-apps`.
- Se aparecer erro de autenticacao do Prisma contra `postgres-service`, confira se `TF_VAR_db_password` e o password do Postgres existente sao iguais. Em ambiente local descartavel, destruir e recriar o cluster/volume tambem resolve.

### CI/CD

Pull requests que alterem `infra/**` ou `k8s/**` executam automaticamente `terraform validate` e `terraform plan` via `.github/workflows/terraform.yml` (rapido, nenhum cluster e criado).

Em push para `main`/`develop` (ou via `workflow_dispatch` manual), o mesmo workflow roda um segundo job que aplica a infraestrutura de verdade: builda a imagem Docker, provisiona um cluster `kind` efemero com `terraform apply`, implanta a aplicacao, roda um smoke test em `/api/v1` e destroi tudo com `terraform destroy` ao final. Isso roda inteiramente dentro do runner do GitHub usando Docker — nenhuma conta de nuvem e envolvida. O job reutiliza o `scripts/local-up.sh`, o mesmo script usado no provisionamento local.

### Migracao para EKS

Consulte `infra/environments/aws/README.md`. O workflow manual
`.github/workflows/deploy-eks.yml` publica a imagem no ECR com a SHA do commit
e aplica `k8s/overlays/aws` por digest, após aprovação do GitHub Environment.
Por padrão, ele usa Ingress ALB interno e requer o AWS Load Balancer Controller.
Para uma conta AWS Academy, marque `aws_academy=true` no dispatch: o workflow
remove o Ingress, usa `Service` `LoadBalancer` (sem IRSA ou recursos IAM),
aguarda o hostname/IP externo e publica `http://<endpoint>:3000` no resumo.
O backend que Auth deve consumir é essa URL sem barra final, com endpoints sob
`/api/v1` (por exemplo, `POST <backend-url>/api/v1/auth/login`). O cluster EKS
deve existir previamente; nenhum recurso AWS é provisionado pelo
workflow. Em `aws_academy=true`, configure no GitHub Environment protegido as
secrets `DATABASE_SECRET_ARN` e `JWT_PRIVATE_KEY_SECRET_ARN`, e a variable
`JWT_PUBLIC_KEY_PARAMETER_NAME`. O runner le o JSON RDS (`username`, `password`,
`host`, `port`, `dbname`), le as chaves JWT pelas referencias AWS, monta
`DATABASE_URL` e aplica somente `DATABASE_URL`, `JWT_PRIVATE_KEY` e
`JWT_PUBLIC_KEY` ao Secret. A etapa falha fechada se qualquer referencia
faltar. No modo normal, o Secret gerenciado continua sendo preexistente e o
comportamento nao muda.

---

## Convencoes de Codigo

Consulte [AGENTS.md](./AGENTS.md) para convencoes de nomenclatura, padroes TypeScript/NestJS e politicas de imports.

---

## Licenca

Privado - Todos os direitos reservados.
