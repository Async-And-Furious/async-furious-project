# Mechanic Shop Management System

> RESTful API for managing service orders, customers, vehicles, and parts inventory.

## 🏗️ Project Objective

This is a backend system for **integrated mechanic shop management**, built with DDD (Domain-Driven Design) architecture based on the Product Requirements Document (PRD).

### Problem It Solves

- **Centralization**: Replaces spreadsheets and manual notes with a unified system
- **Tracking**: Customers track service order status via public API
- **Inventory Control**: Parts management with minimum stock alerts
- **Validation**: CPF/CNPJ and Brazilian vehicle plates follow local standards

### Main Features

| Module             | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| **Service Orders** | Creation, lifecycle (RECEIVED → DELIVERED), quote approval |
| **Customers**      | Registration with CPF/CNPJ validation                      |
| **Vehicles**       | Registration with Brazilian plate validation               |
| **Parts**          | Full CRUD with inventory control                           |
| **Authentication** | JWT for admin endpoints                                    |
| **Tracking**       | Public API for status queries                              |

---

## 🛠️ Technologies

| Layer          | Technology      |
| -------------- | --------------- |
| Framework      | NestJS 11.x     |
| Language       | TypeScript 5.x  |
| Database       | PostgreSQL 15   |
| ORM            | Prisma          |
| Authentication | JWT + bcrypt    |
| Documentation  | Swagger/OpenAPI |
| Container      | Docker Compose  |

---

## 📋 Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15 (or via Docker)

---

## 🚀 How to Run Locally

### 1. Clone the repository

```bash
git clone <repo-url>
cd async-furious-project
```

### 2. Configure environment variables

Create a `.env` file at the project root:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workshop
JWT_SECRET=your-secret-key-here
```

### 3. Start with Docker Compose

```bash
docker compose up -d
```

This starts:

- PostgreSQL on port 5432
- Application on port 3000

### 4. Without Docker (alternative)

```bash
# Install dependencies
npm install

# Run migrations
npx prisma migrate dev

# Start development
npm run start:dev
```

---

## 📚 API Documentation

After starting the project, access Swagger documentation at:

```
http://localhost:3000/api/docs
```

### Main Routes

#### Root

| Method | Endpoint | Description       |
| ------ | -------- | ----------------- |
| GET    | `/`      | Root health check |

#### Authentication

| Method | Endpoint         | Description       |
| ------ | ---------------- | ----------------- |
| POST   | `/auth/register` | Register new user |
| POST   | `/auth/login`    | Get JWT token     |

#### Customers (Protected - JWT)

| Method | Endpoint         | Description | Access        |
| ------ | ---------------- | ----------- | ------------- |
| POST   | `/customers`     | Create      | Admin only    |
| GET    | `/customers`     | List all    | Authenticated |
| GET    | `/customers/:id` | Get details | Authenticated |
| PATCH  | `/customers/:id` | Update      | Admin only    |
| DELETE | `/customers/:id` | Delete      | Admin only    |

#### Coming Soon

| Module         | Endpoint          | Status      |
| -------------- | ----------------- | ----------- |
| Service Orders | `/service-orders` | Coming soon |
| Vehicles       | `/vehicles`       | Coming soon |
| Parts          | `/parts`          | Coming soon |
| Tracking       | `/track/:soId`    | Coming soon |

---

## 🔐 Authentication

- Endpoints under `/customers` require JWT token (except listing)
- Endpoints under `/auth/*` are public
- Token: Bearer with 1-hour expiry

---

## 🧪 Running Tests

```bash
# All tests
npm run test

# With coverage
npm run test:cov

# Watch mode
npm run test:watch

# Specific test by name
npm run test -- --testNamePattern="Customer"

# Specific test file
npm run test -- src/modules/infrastructure/auth/auth.service.spec.ts
```

### Build and Lint Commands

```bash
# Production build
npm run build

# Format code
npm run format

# Lint with auto-fix
npm run lint
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

```
src/
├── modules/
│   ├── domain/
│   │   └── customers/          # Customer aggregate
│   │       ├── customer.controller.ts
│   │       ├── customer.service.ts
│   │       ├── customer.module.ts
│   │       └── dto/
│   └── infrastructure/
│       ├── auth/                # Authentication & authorization
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── guards/
│       │   └── strategies/
│       └── database/            # Prisma connection
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

---

## 📝 Code Conventions

See [AGENTS.md](./AGENTS.md) for:

- Naming conventions
- TypeScript/NestJS code patterns
- Import and formatting policies
- ESLint/Prettier configuration

---

## 📄 License

Private - All rights reserved
