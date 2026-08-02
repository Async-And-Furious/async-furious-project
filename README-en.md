# Workshop Management System

> RESTful API for managing service orders, customers, vehicles, and parts inventory.

Versao em portugues: [README.md](./README.md)

## Project Goal

Backend for **integrated auto repair shop management**, built as the FIAP Software Architecture graduate Tech Challenge (15SOAT). The architecture combines Clean Architecture and DDD.

### Problem It Solves

- **Centralization**: replaces spreadsheets and manual processes with one system.
- **Tracking**: lets users track service order status in real time.
- **Inventory control**: manages parts, minimum stock, and supplier requests.
- **Validation**: applies Brazilian CPF/CNPJ and vehicle plate rules.

### Main Features

| Module | Description |
| ------ | ----------- |
| **Service Orders** | Complete lifecycle from reception to delivery. |
| **Customers** | CRUD with CPF/CNPJ validation. |
| **Vehicles** | CRUD with Brazilian plate validation. |
| **Services** | Catalog of services offered by the shop. |
| **Parts and Supplies** | CRUD with inventory control and supplier requests. |
| **Payments** | Payment registration with automatic delivery trigger. |
| **Authentication** | JWT with `ADMIN`, `RECEPCIONISTA`, and `MECANICO` roles. |

---

## Technologies

| Layer | Technology |
| ----- | ---------- |
| Framework | NestJS 10.x |
| Language | TypeScript 5.x |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Authentication | JWT + bcrypt |
| Documentation | Swagger / OpenAPI |
| Container | Docker Compose |
| Tests | Jest |
| DAST security | OWASP ZAP |
| IaC | Terraform 1.6+ |
| Orchestration | Kubernetes with kind |

We use Node.js with NestJS for modular architecture and native dependency injection, PostgreSQL for transactional consistency, and Prisma for strong TypeScript-integrated typing.

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker and Docker Compose
- Terraform 1.6+
- kind (`go install sigs.k8s.io/kind@latest` or install through your package manager)

---

## Running Locally

### 1. Clone the repository

```bash
git clone <repo-url>
cd async-furious-project
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workshop"
JWT_SECRET="change-me-in-production-use-openssl-rand-hex-32"
PORT=3000
BCRYPT_SALT_ROUNDS=10
ALLOWED_ORIGINS=http://localhost:3000
SEED_ADMIN_EMAIL="admin@oficina.com"
SEED_ADMIN_PASSWORD="changeme123"
```

### 3. Start with Docker for development

```bash
# Start PostgreSQL only
docker compose -f docker-compose.dependencies.yml up -d

# Run migrations, seed, and the app in watch mode
pnpm run dev
```

### 4. Or start the full stack

```bash
# Start PostgreSQL + application
docker compose up -d
```

The application is available at `http://localhost:3000`.

---

## API Documentation

After starting the project, open Swagger at:

```text
http://localhost:3000/api/docs
```

The Insomnia collection with configured routes is available at:

```text
docs/http/insomnia.yaml
```

### Routes

#### Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/auth/register` | ADMIN | Register a new user. |
| POST | `/auth/login` | Public | Log in and return a JWT. |

#### Customers (`/api/v1/clientes`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/clientes` | RECEPCIONISTA | Create customer. |
| GET | `/clientes` | Authenticated | List customers. |
| GET | `/clientes/:id` | Authenticated | Get customer details. |
| PATCH | `/clientes/:id` | RECEPCIONISTA | Update customer. |
| DELETE | `/clientes/:id` | ADMIN | Delete customer. |

#### Vehicles (`/api/v1/veiculos`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/veiculos` | RECEPCIONISTA | Create vehicle. |
| GET | `/veiculos` | Authenticated | List vehicles. |
| GET | `/veiculos/:id` | Authenticated | Get vehicle details. |
| PATCH | `/veiculos/:id` | RECEPCIONISTA | Update vehicle. |
| DELETE | `/veiculos/:id` | ADMIN | Delete vehicle. |

#### Services (`/api/v1/servicos`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/servicos` | ADMIN | Create service. |
| GET | `/servicos` | Authenticated | List services. |
| GET | `/servicos/:id` | Authenticated | Get service details. |
| PATCH | `/servicos/:id` | ADMIN | Update service. |
| DELETE | `/servicos/:id` | ADMIN | Delete service. |

#### Service Orders (`/api/v1/ordens-servico`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/ordens-servico` | RECEPCIONISTA | Create service order. |
| GET | `/ordens-servico` | Authenticated | List service orders. |
| GET | `/ordens-servico/:id` | Authenticated | Get service order details. |
| GET | `/ordens-servico/:id/status` | Authenticated | Check service order status. |
| PATCH | `/ordens-servico/:id` | ADMIN | Update service order. |
| DELETE | `/ordens-servico/:id` | ADMIN | Delete service order. |
| PATCH | `/ordens-servico/:id/assumir` | MECANICO | Mechanic takes ownership. |
| PATCH | `/ordens-servico/:id/analisar` | MECANICO | Register diagnostic analysis. |
| PATCH | `/ordens-servico/:id/servicos-insumos` | MECANICO | Generate estimate. |
| PATCH | `/ordens-servico/:id/orcamento/aprovar` | Public | Customer approves estimate. |
| PATCH | `/ordens-servico/:id/orcamento/recusar` | Public | Customer rejects estimate. |
| PATCH | `/ordens-servico/:id/aprovar-servico` | Public | Customer approves performed service. |
| PATCH | `/ordens-servico/:id/finalizar-execucao` | MECANICO | Mechanic finishes execution. |
| PATCH | `/ordens-servico/:id/registrar-entrega` | RECEPCIONISTA | Register delivery. |
| GET | `/ordens-servico/tempo-medio` | ADMIN | Check average execution time. |

#### Parts and Supplies (`/api/v1/pecas`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/pecas` | ADMIN | Create part or supply. |
| GET | `/pecas` | Authenticated | List parts and supplies. |
| GET | `/pecas/:id` | Authenticated | Get part or supply details. |
| PATCH | `/pecas/:id` | ADMIN | Update part or supply. |
| PATCH | `/pecas/:id/estoque` | ADMIN | Update stock. |
| DELETE | `/pecas/:id` | ADMIN | Delete part or supply. |
| POST | `/pecas/fornecedor/solicitar` | ADMIN | Request parts from supplier. |
| PATCH | `/pecas/fornecedor/pedidos/:pedidoId/receber` | ADMIN | Confirm receipt of parts. |

#### Payments (`/api/v1/pagamentos`)

| Method | Endpoint | Access | Description |
| ------ | -------- | ------ | ----------- |
| POST | `/pagamentos/registrar` | Authenticated | Register payment and trigger service order delivery. |

---

## Service Order Lifecycle

```text
RECEIVED
  -> UNDER_DIAGNOSIS
      -> AWAITING_APPROVAL
          -> CLOSED_WITHOUT_EXECUTION  (estimate rejected)
          -> IN_PROGRESS
              -> AWAITING_PARTS  (parts unavailable)
                  -> IN_PROGRESS  (parts reserved)
              -> FINISHED
                  -> DELIVERED
```

---

## Authentication and Roles

All endpoints except those marked with `@Public()` require the `Authorization: Bearer <token>` header.

| Role | Main permissions |
| ---- | ---------------- |
| `ADMIN` | Full access: services, parts, and administrative management. |
| `RECEPCIONISTA` | Creates and updates customers/vehicles, creates service orders, and registers delivery. |
| `MECANICO` | Takes service orders, diagnoses, generates estimates, and finishes execution. |

JWT tokens expire in **1 hour**.

---

## Tests

```bash
# All unit tests
pnpm test

# Coverage report
pnpm test:cov

# Watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e

# Specific file
pnpm test -- test/cadastro/use-cases/cliente.use-cases.spec.ts

# By test name
pnpm test -- --testNamePattern="CreateClienteUseCase"
```

### Coverage Thresholds

| Metric | Minimum |
| ------ | ------- |
| Statements | 85% |
| Lines | 85% |
| Functions | 80% |
| Branches | 80% |

---

## Project Structure

```text
src/
├── auth/                    # JWT, guards, strategies, decorators
├── modules/
│   ├── cadastro/            # Customers, Vehicles, Services
│   │   ├── domain/          # Entities, VOs, repository interfaces
│   │   ├── application/     # Use cases
│   │   ├── infrastructure/  # Prisma repositories
│   │   └── presentation/    # Controllers, DTOs
│   ├── ordem-servico/       # Service Orders + Estimates
│   ├── pecas-insumos/       # Parts, stock, supplier requests
│   └── financeiro/          # Payments
└── shared/
    ├── domain/              # DomainEvent base, exceptions, interfaces
    └── infrastructure/      # PrismaService, EventEmitter, filters
```

Each module follows the dependency rule: `presentation -> application -> domain <- infrastructure`.

---

## Useful Commands

```bash
# Development with PostgreSQL, migrations, seed, and app
pnpm run dev

# Production build
pnpm run build

# Run production build
pnpm run prod

# Lint with auto-fix
pnpm run lint

# Format code
pnpm run format
```

---

## Infrastructure as Code (Terraform + Kubernetes)

Local infrastructure is provisioned with Terraform on a local Kubernetes cluster created by kind.

### Prerequisites

- Docker running
- `terraform` 1.6+
- `kind`
- `kubectl`

### Structure

```text
/infra
  versions.tf                        # Provider versions
  /modules/kind-cluster              # Creates a kind cluster with control-plane and worker
  /modules/kubernetes-apps           # Applies manifests through the kubectl provider
  /environments/local                # Local environment
  /environments/aws/README.md        # EKS migration stub

/k8s
  namespace.yaml
  /config    configmap.yaml, secret.yaml
  /app       deployment.yaml, service.yaml, hpa.yaml
  /database  statefulset.yaml, service.yaml, pvc.yaml
```

### Start the local environment (automated script)

Use `scripts/local-up.sh` — it runs every step in the correct order:

```bash
# Full provisioning: build image, create kind cluster, terraform apply,
# load image into nodes, wait for Postgres, run Prisma migrations, smoke test
./scripts/local-up.sh up

# Rebuild image + reload into existing cluster (no infra teardown)
./scripts/local-up.sh reload

# Destroy the environment
./scripts/local-up.sh down
```

Set `TF_VAR_db_password`, `TF_VAR_jwt_secret`, `TF_VAR_seed_admin_email` and
`TF_VAR_seed_admin_password` as environment variables or in `.env.local`
before running — the script will prompt interactively if they are not found.

### Start the local environment (manual)

Run commands from the repository root unless noted otherwise.

```bash
# 1. Build the local API image
docker build -t async-furious-api:latest .

# 2. Sensitive variables used by Terraform
export TF_VAR_db_password="postgres"
export TF_VAR_jwt_secret="change-me-in-production-use-openssl-rand-hex-32"
export TF_VAR_seed_admin_email="admin@oficina.com"
export TF_VAR_seed_admin_password="changeme123"

# 3. Create the cluster and apply manifests
cd infra/environments/local
terraform init
terraform apply

# 4. Load image into kind nodes (required because imagePullPolicy: Never)
kind load docker-image async-furious-api:latest --name async-furious

# 5. Recreate API pods
kubectl rollout restart deployment/async-furious-api -n async-furious
```

### Watch the deployment

```bash
kubectl get pods -n async-furious -w
kubectl rollout status deployment/async-furious-api -n async-furious --timeout=240s
kubectl get events -n async-furious --sort-by=.lastTimestamp -w
```

If the API breaks during bootstrap:

```bash
kubectl logs -n async-furious -l app=async-furious-api --previous --tail=100
kubectl describe pod -n async-furious -l app=async-furious-api
```

The API should respond on the status endpoint exposed at `/api/v1`:

```bash
curl http://localhost:30000/api/v1
```

To destroy the local environment:

```bash
cd infra/environments/local
terraform destroy
# or: ./scripts/local-up.sh down
```

### Rebuild and redeploy the API

```bash
# Via script (recommended)
./scripts/local-up.sh reload

# Manual
docker build -t async-furious-api:latest .
kind load docker-image async-furious-api:latest --name async-furious
kubectl rollout restart deployment/async-furious-api -n async-furious
kubectl rollout status deployment/async-furious-api -n async-furious --timeout=240s
curl http://localhost:30000/api/v1
```

### Important notes

- Kubernetes probes must point to `/api/v1`, not `/health`.
- If you see `ErrImageNeverPull`, load the image with `kind load docker-image` or use `./scripts/local-up.sh reload`.
- The `migrate` init container runs `prisma migrate deploy` before each API pod starts.
- HPA requires metrics-server, which is installed automatically by the `kubernetes-apps` module.
- If Prisma reports authentication failure against `postgres-service`, check that `TF_VAR_db_password` and the existing PostgreSQL password match. In disposable local environments, destroying and recreating the cluster/volume also fixes it.

### CI/CD

Pull requests that change `infra/**` or `k8s/**` automatically run `terraform validate` and `terraform plan` through `.github/workflows/terraform.yml` (fast, no cluster is created).

On push to `main`/`develop` (or via manual `workflow_dispatch`), the same workflow runs a second job that applies the infrastructure for real: it builds the Docker image, provisions an ephemeral `kind` cluster with `terraform apply`, deploys the app, runs a smoke test against `/api/v1`, and tears everything down with `terraform destroy`. This runs entirely inside the GitHub-hosted runner using Docker — no cloud account is involved. It reuses `scripts/local-up.sh`, the same script used for local provisioning.

### EKS Migration

See `infra/environments/aws/README.md`.

---

## Architectural Documentation (Phase 3)

The full documentation for the Phase 3 distributed architecture (four
repositories, centralized authentication via API Gateway + Serverless
Function, Kubernetes/EKS, managed database, observability, CI/CD, ADRs and
RFCs) lives in [docs/README.md](./docs/README.md).

It explicitly distinguishes what is **implemented today** (this repository,
local monolith) from what is **Phase 3 proposal** (decided via ADR/RFC, but
still at skeleton stage in the `repo-auth-serverless`, `repo-k8s-infra` and
`repo-db-infra` repositories).

## Code Conventions

See [AGENTS.md](./AGENTS.md) for naming conventions, TypeScript/NestJS patterns, and import policies.

---

## License

Private - All rights reserved.
