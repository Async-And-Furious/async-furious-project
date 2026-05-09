
# Mechanic Shop Management System

> RESTful API for managing service orders, customers, vehicles, parts inventory, and payments.

## 🏗️ Project Objective

Backend for **integrated mechanic shop management**, developed as a Tech Challenge for the Software Architecture postgrad (FIAP). Architecture: Clean Architecture + DDD.

### Problem It Solves

- **Centralization**: Replaces spreadsheets and manual processes with a unified system
- **Tracking**: Customers track service order status in real time
- **Inventory Control**: Parts management with minimum stock alerts and supplier requests
- **Validation**: CPF/CNPJ and vehicle plates follow Brazilian standards

### Main Features

| Module                | Description                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| **Service Orders**    | Full lifecycle (RECEIVED → DELIVERED), quote and customer approval              |
| **Customers**         | CRUD with CPF/CNPJ validation                                                   |
| **Vehicles**          | CRUD with Brazilian plate validation                                            |
| **Services**          | Catalog of services offered                                                     |
| **Parts & Supplies**  | CRUD with inventory control and supplier requests                               |
| **Payments**          | Payment registration with automatic delivery trigger                            |
| **Authentication**    | JWT with roles: ADMIN, RECEPTIONIST, MECHANIC                                   |

---

## 🛠️ Technologies

| Layer          | Technology           |
| -------------- | -------------------- |
| Framework      | NestJS 10.x          |
| Language       | TypeScript 5.x       |
| Database       | PostgreSQL 15        |
| ORM            | Prisma               |
| Authentication | JWT + bcrypt         |
| Documentation  | Swagger / OpenAPI    |
| Container      | Docker Compose       |
| Tests          | Jest                 |
| Security DAST  | OWASP ZAP            |
| Package Manager| pnpm                 |

---

## 📋 Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker and Docker Compose

---

## 🚀 How to Run Locally

### 1. Clone the repository

```bash
git clone <repo-url>
cd async-furious-project
```

### 2. Configure environment variables

Copy the example file and edit as needed:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workshop"
JWT_SECRET="your-secret-key-here"
PORT=5000
BCRYPT_SALT_ROUNDS=10
ALLOWED_ORIGINS=http://localhost:5000
SEED_ADMIN_EMAIL="your-admin-email"
SEED_ADMIN_PASSWORD="your-admin-password"
```

### 3. Start with Docker (recommended)

```bash
# Start only PostgreSQL
docker compose -f docker-compose.dependencies.yml up -d

# Run migrations + seed + app in watch mode
pnpm run dev
```

### 4. Or start full stack

```bash
# Start PostgreSQL + app
docker compose up -d
```

The app will be available at `http://localhost:5000`.

---

## 📚 API Documentation

After starting the project, access Swagger docs at:

```
http://localhost:5000/api/docs
```

The Insomnia collection with all routes is at:

```
docs/http/insomnia.yaml
```

### Main Routes

#### Authentication (`/api/v1/auth`)

| Method | Endpoint         | Access           | Description               |
| ------ | ---------------- | ---------------- | ------------------------- |
| POST   | `/auth/register` | ADMIN            | Register new user         |
| POST   | `/auth/login`    | Public           | Login, returns JWT        |

#### Customers (`/api/v1/clientes`)

| Method | Endpoint         | Access        | Description          |
| ------ | ---------------- | ------------- | -------------------- |
| POST   | `/clientes`      | RECEPTIONIST  | Create customer      |
| GET    | `/clientes`      | Authenticated | List customers      |
| GET    | `/clientes/:id`  | Authenticated | Get customer        |
| PATCH  | `/clientes/:id`  | RECEPTIONIST  | Update customer     |
| DELETE | `/clientes/:id`  | ADMIN         | Delete customer     |

#### Vehicles (`/api/v1/veiculos`)

| Method | Endpoint         | Access        | Description          |
| ------ | ---------------- | ------------- | -------------------- |
| POST   | `/veiculos`      | RECEPTIONIST  | Create vehicle       |
| GET    | `/veiculos`      | Authenticated | List vehicles       |
| GET    | `/veiculos/:id`  | Authenticated | Get vehicle         |
| PATCH  | `/veiculos/:id`  | RECEPTIONIST  | Update vehicle      |
| DELETE | `/veiculos/:id`  | ADMIN         | Delete vehicle      |

#### Services (`/api/v1/servicos`)

| Method | Endpoint         | Access      | Description          |
| ------ | ---------------- | ---------- | -------------------- |
| POST   | `/servicos`      | ADMIN      | Create service       |
| GET    | `/servicos`      | Authenticated | List services    |
| GET    | `/servicos/:id`  | Authenticated | Get service      |
| PATCH  | `/servicos/:id`  | ADMIN      | Update service      |
| DELETE | `/servicos/:id`  | ADMIN      | Delete service      |

#### Service Orders (`/api/v1/ordens-servico`)

| Method | Endpoint                              | Access        | Description                                      |
| ------ | ------------------------------------- | ------------- | ---------------------------------------------- |
| POST   | `/ordens-servico`                     | RECEPTIONIST  | Create service order                            |
| GET    | `/ordens-servico`                     | Authenticated | List service orders                             |
| GET    | `/ordens-servico/:id`                 | Authenticated | Get service order                               |
| GET    | `/ordens-servico/:id/status`          | Authenticated | Get status (public endpoint for customer)        |
| PATCH  | `/ordens-servico/:id`                 | ADMIN         | Update service order                            |
| DELETE | `/ordens-servico/:id`                 | ADMIN         | Delete service order                            |
| PATCH  | `/ordens-servico/:id/assumir`         | MECHANIC      | Mechanic takes order → UNDER_DIAGNOSIS          |
| PATCH  | `/ordens-servico/:id/analisar`        | MECHANIC      | Register diagnostic analysis                    |
| PATCH  | `/ordens-servico/:id/servicos-insumos`| MECHANIC      | Generate quote → AWAITING_APPROVAL              |
| PATCH  | `/ordens-servico/:id/orcamento/aprovar` | Public      | Customer approves quote → IN_PROGRESS           |
| PATCH  | `/ordens-servico/:id/orcamento/recusar` | Public      | Customer rejects → CLOSED_WITHOUT_EXECUTION     |
| PATCH  | `/ordens-servico/:id/aprovar-servico` | Public        | Customer approves performed service             |
| PATCH  | `/ordens-servico/:id/finalizar-execucao` | MECHANIC   | Mechanic finishes → FINISHED                    |
| PATCH  | `/ordens-servico/:id/registrar-entrega` | RECEPTIONIST | Register delivery → DELIVERED                   |
| GET    | `/ordens-servico/tempo-medio`         | ADMIN         | Average execution time for service orders        |

#### Parts & Supplies (`/api/v1/pecas`)

| Method | Endpoint         | Access      | Description          |
| ------ | ---------------- | ---------- | -------------------- |
| POST   | `/pecas`         | ADMIN      | Create part          |
| GET    | `/pecas`         | Authenticated | List parts       |
| GET    | `/pecas/:id`     | Authenticated | Get part         |
| PATCH  | `/pecas/:id`     | ADMIN      | Update part         |
| PATCH  | `/pecas/:id/estoque` | ADMIN  | Update stock quantity |
| DELETE | `/pecas/:id`     | ADMIN      | Delete part         |
| POST   | `/pecas/fornecedor/solicitar` | ADMIN | Request part replenishment from supplier |
| PATCH  | `/pecas/fornecedor/pedidos/:pedidoId/receber` | ADMIN | Confirm supplier order receipt and update stock |

#### Payments (`/api/v1/pagamentos`)

| Method | Endpoint         | Access      | Description          |
| ------ | ---------------- | ---------- | -------------------- |
| POST   | `/pagamentos/registrar` | Authenticated | Register payment and trigger service-order delivery flow |

---

## 🔐 Authentication

- Endpoints under `/clientes`, `/veiculos`, `/servicos`, `/ordens-servico`, `/pecas`, `/pagamentos/registrar` require JWT token (except public endpoints)
- Endpoints under `/auth/*` are public
- Token: Bearer with 1-hour expiry
- Roles: ADMIN, RECEPTIONIST, MECHANIC

---

## 🧪 Running Tests

```bash
# All tests
pnpm run test

# With coverage
pnpm run test:cov

# Watch mode
pnpm run test:watch

# Specific test by name
pnpm run test -- --testNamePattern="Cliente"

# Specific test file
pnpm run test -- src/modules/cadastro/application/use-cases/cliente.use-cases.spec.ts
```

### Build and Lint Commands

```bash
# Production build
pnpm run build

# Format code
pnpm run format

# Lint with auto-fix
pnpm run lint
```

### Minimum Coverage (per PRD)

| Domain              | Minimum |
| ------------------- | ------- |
| OS lifecycle        | 90%     |
| CPF/CNPJ validation | 85%     |
| Quote calculation   | 90%     |
| Inventory control   | 85%     |
| Status transitions  | 90%     |

---

## 📁 Project Structure (DDD)

See [AGENTS.md](./AGENTS.md) for:

- Naming conventions
- TypeScript/NestJS code patterns
- Import and formatting policies
- ESLint/Prettier configuration

---

## 📄 License

Private - All rights reserved
