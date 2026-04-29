# AGENTS.md - Workshop Management API

> Compact operational guide for agents. Each line answers: "Would I likely miss this?"

---

## 🚦 Commands

```bash
# Development (PostgreSQL + app + tests on start)
npm run dev

# Manual alternatives
npm run build          # Production build
npm run prod           # Run built app (node dist/main)
npm run lint           # ESLint + auto-fix
npm run format         # Prettier format

# Tests
npm run test           # All unit tests
npm run test:watch     # Watch mode
npm run test:cov       # Coverage
npm run test:e2e       # E2E (requires DB)

# Single test
npm run test -- src/modules/cadastro/application/use-cases/cliente.use-cases.spec.ts
npm run test -- --testNamePattern="CreateClienteUseCase"

# Database
npx prisma migrate dev   # Run migrations
npx prisma generate     # Generate Prisma client
npx prisma db push      # Push schema (skip generate)
```

**NOTE:** `npm run dev` runs all tests on every file change — disruptive for TDD. Use `nest start --watch` manually during active development.

---

## 🏗️ Architecture

### Modules (4 domain modules)

| Module | Path | Entities |
|--------|------|----------|
| `cadastro` | `src/modules/cadastro/` | Cliente, Veiculo, Servico |
| `pecas-insumos` | `src/modules/pecas-insumos/` | Peca |
| `ordem-servico` | `src/modules/ordem-servico/` | OrdemServico, Orcamento |
| `auth` | `src/auth/` | User (JWT) |

### Shared
- `src/shared/domain/exceptions/` — Domain exceptions
- `src/shared/infrastructure/database/` — PrismaModule
- `src/shared/infrastructure/filters/` — GlobalExceptionFilter

### Layer Rules (strict)

```
presentation → application → domain
                              ↕
                    infrastructure (implements domain interfaces)
```

- **Domain**: ZERO external dependencies. No PrismaService, no JwtService.
- **Application**: Depends only on domain.
- **Infrastructure**: Implements domain interfaces.
- **Presentation**: Depends on application.

### Entry Points
- API prefix: `api/v1`
- Swagger: `/api/docs`
- Health check: `GET /` → `AppController`

---

## 📦 Tech Stack

| Concern | Tool |
|---------|------|
| Framework | NestJS 10.x |
| Runtime | Node.js 20 (.nvmrc) |
| Package manager | pnpm (Dockerfile uses pnpm, not npm) |
| Database | PostgreSQL 15 (docker-compose.dependencies.yml) |
| ORM | Prisma 5.x |
| Auth | JWT + bcrypt |
| API docs | Swagger/OpenAPI |
| Testing | Jest + supertest |
| Lint | typescript-eslint + prettier |

---

## 🗄️ Database

### Prisma Schema
- Location: `prisma/schema.prisma`
- Uses **snake_case** column names (mapped via `@map`)
- ORM entities in `infrastructure/persistence/` (not plain Prisma)

### Migrations
```bash
npx prisma migrate dev   # Development
npx prisma migrate deploy # Production
```

### Key Models
- `Cliente` → `Customer` table (with `nome`, `documento`, `tipo_documento`)
- `Veiculo` → `Vehicle` table (with `placa`, `marca`, `modelo`, `ano`)
- `OrdemServico` → `ServiceOrder` table (with `id_veiculo`, `id_cliente`)
- `Orcamento` → `Estimate` table (1:1 with OrdemServico)
- `Peca` → `Part` table
- `Servico` → `Service` table

### Enums
- `TaxIdType`: `CPF`, `CNPJ`
- `SOStatus`: `RECEIVED`, `UNDER_DIAGNOSIS`, `AWAITING_APPROVAL`, `IN_PROGRESS`, `FINISHED`, `DELIVERED`
- `EstimateStatus`: `PENDING`, `APPROVED`, `REJECTED`

---

## 🔐 Auth

- JWT via `@nestjs/jwt` + `@nestjs/passport`
- Passport strategy: JWT Bearer
- Guards: `JwtAuthGuard`, `RolesGuard`
- Auth endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`
- Protected routes require `Authorization: Bearer <token>`
- Cookie-based auth also supported (cookie-parser enabled)

---

## 🧪 Testing Patterns

```typescript
// Unit test structure (use-cases)
describe('CreateClienteUseCase', () => {
  let useCase: CreateClienteUseCase;
  let mockRepo: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepo = { create: jest.fn() } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new CreateClienteUseCase(mockRepo);
  });

  it('should create cliente', async () => {
    mockRepo.create.mockResolvedValue({ id: '1', ...input } as Cliente);
    const result = await useCase.execute(input);
    expect(result.id).toBe('1');
  });
});
```

- Test files: `*.spec.ts` (co-located with source)
- E2E tests: `test/jest-e2e.json`
- Jest config: `jest.config.js`
- `tsconfig.json` path alias: `@/*` → `./src/*`

---

## ⚠️ Critical Rules

1. **Never use `as any`** — Use `unknown` if type is uncertain
2. **Never use `@ts-ignore`**
3. **Domain has ZERO external imports** — No PrismaService, no JwtService
4. **Repository interfaces live in domain** — Infrastructure implements them
5. **Unused params: prefix with `_`** — `@Get() getOne(@Param('id') _id: string)`
6. **Validate with class-validator** — DTOs in `presentation/dto/`
7. **Use NestJS exceptions** — `NotFoundException`, `BadRequestException`, etc.
8. **No passwords in commits** — Use `.env`, gitignored

---

## 🎯 Code Conventions

### Naming
| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `cliente.controller.ts` |
| Classes | PascalCase | `CreateClienteUseCase` |
| Interfaces | PascalCase + I prefix | `IClienteRepository` |
| Variables | camelCase | `clienteId` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| DB columns | snake_case | `created_at`, `id_cliente` |

### TypeScript
- Strict mode (but `noImplicitAny: false` — legacy)
- Decorators enabled
- Return types: always explicit for public methods

### Decorators
```typescript
@Controller('clientes')           // Route prefix
@Get() @Post() @Patch() @Put() @Delete()  // HTTP methods
@UseGuards(JwtAuthGuard)         // Auth guard
@Roles('admin')                   // Role check
@Param('id', ParseUUIDPipe)      // Param with validation
```

### ValidationPipe (global, main.ts)
```typescript
whitelist: true,           // Strip non-decorated props
forbidNonWhitelisted: true, // Error on extra props
transform: true            // Auto-transform payloads
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Bootstrap: CORS, helmet, cookie-parser, Swagger, ValidationPipe, GlobalExceptionFilter |
| `src/app.module.ts` | Root module imports |
| `src/modules/*/presentation/controllers/*.ts` | HTTP handlers |
| `src/modules/*/domain/entities/*.ts` | Business entities |
| `src/modules/*/application/use-cases/*.ts` | Use cases |
| `src/modules/*/infrastructure/repositories/*.ts` | Repository implementations |
| `scripts/docker/wait-for-postgres.ts` | Dev script to wait for Postgres |

---

## 🔧 Dev Setup

### Requirements
- Node.js 20 (see `.nvmrc`)
- Docker + Docker Compose
- PostgreSQL 15

### Quick Start (with Docker)
```bash
docker compose -f docker-compose.dependencies.yml up -d  # Postgres only
npx prisma migrate dev
npm run dev
```

### Environment
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workshop
JWT_SECRET=your-secret
PORT=3000
```

---

## 📚 Resources

- NestJS: https://docs.nestjs.com/
- Prisma: https://prisma.io/docs/
- Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
