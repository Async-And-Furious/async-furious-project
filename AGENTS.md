# AGENTS.md — Workshop Service System

> Build/test/coding guidelines for this NestJS project.
> **Greenfield project** — No code yet. Follow PRD patterns below.

## Quick Reference

| Command                                    | Description          |
| ------------------------------------------ | -------------------- |
| `npm run build`                            | Compile TypeScript   |
| `npm run lint`                             | Lint and fix files   |
| `npm run format`                           | Format with Prettier |
| `npm run test`                             | Run all tests        |
| `npm run test -- --testNamePattern="name"` | Run single test      |

## Build & Testing

```bash
npm run start:dev      # Watch mode
npm run start:debug    # Debug with breakpoints
npm run build          # Production build
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:cov       # Coverage report
npm run lint           # Lint and auto-fix
npm run format         # Format with Prettier
```

## Project Context

**Tech Stack**: NestJS + TypeScript + PostgreSQL 15 + Prisma ORM  
**Auth**: JWT (admin) + Public tracking endpoint  
**Domain**: Customer, Vehicle, Service Order, Parts

## Code Style Guidelines

### Project Structure (DDD)

```
src/
├── domain/           # Business logic - entities, value objects
│   ├── customer/     # TaxId (CPF/CNPJ) validation
│   ├── vehicle/      # LicensePlate (Brazilian)
│   ├── service-order/ # SOStatus lifecycle, Quote
│   └── parts/        # Inventory control
├── application/     # Use cases, DTOs
├── infrastructure/  # DB, auth, config
└── interfaces/      # REST controllers
```

### Imports

```typescript
// Order: External → Internal → Relative
import { Injectable } from '@nestjs/common';
import { Customer } from '@/domain/customer/entities/customer.entity';
```

### Naming Conventions

| Type          | Convention       | Example                    |
| ------------- | ---------------- | -------------------------- |
| Files         | kebab-case       | `customer.service.ts`      |
| Classes       | PascalCase       | `Customer`, `ServiceOrder` |
| Value Objects | PascalCase       | `TaxId`, `Money`           |
| Methods       | camelCase        | `createCustomer`           |
| DTOs          | PascalCase + Dto | `CreateCustomerDto`        |
| Database      | snake_case       | `customers`, `created_at`  |

---

## Domain Patterns (from PRD)

### TaxId (CPF/CNPJ)

```typescript
export class TaxId extends ValueObject<{ value: string; type: TaxIdType }> {
  static readonly CPF_LENGTH = 11, CNPJ_LENGTH = 14;
  static create(value: string): TaxId {
    const digits = value.replace(/\D/g, '');
    const type = digits.length === 11 ? TaxIdType.CPF : TaxIdType.CNPJ;
    if (!this.validateCheckDigit(digits, type)) throw new Error('Invalid Tax ID');
    return new TaxId({ value: digits, type });
  }
}
```

### SOStatus Lifecycle

```typescript
export enum SOStatus {
  RECEIVED,
  UNDER_DIAGNOSIS,
  AWAITING_APPROVAL,
  IN_PROGRESS,
  FINISHED,
  DELIVERED,
}
// Valid: RECEIVED → UNDER_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → FINISHED → DELIVERED
// Also: AWAITING_APPROVAL → FINISHED (if rejected)
```

### Money & LicensePlate

```typescript
// Money: Non-negative, 2 decimal places
export class Money {
  static create(amount: number): Money {
    if (amount < 0) throw new Error('Money cannot be negative');
    return new Money(Math.round(amount * 100) / 100);
  }
}

// LicensePlate: Brazilian format (AAA-1234 or AAA1A23)
export class LicensePlate {
  private static readonly PATTERN = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  static create(value: string): LicensePlate {
    const normalized = value.toUpperCase().replace(/-/g, '');
    if (!this.PATTERN.test(normalized)) throw new Error('Invalid license plate');
    return new LicensePlate(normalized);
  }
}
```

---

## API Patterns

### Admin (JWT Required)

```typescript
@Controller('api/v1/service-orders')
@UseGuards(JwtAuthGuard)
export class ServiceOrderController {
  @Post() create(@Body() dto: CreateServiceOrderDto) {}
  @Get() findAll(@Query() query: ListQuery) {}
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {}
}
```

### Public Tracking (No Auth)

```typescript
@Controller('api/v1/track')
export class TrackingController {
  @Get(':soId') track(@Param('soId') soId: string) {
    /* soId, status, vehiclePlate, services, createdAt, lastUpdated */
  }
}
```

---

## Testing Guidelines

```typescript
describe('CustomerService', () => {
  let service: CustomerService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CustomerService, { provide: CustomerRepository, useValue: mockRepo }],
    }).compile();
    service = module.get<CustomerService>(CustomerService);
  });
  it('should be defined', () => expect(service).toBeDefined());
});
```

### Coverage Requirements (from PRD)

| Domain                      | Minimum |
| --------------------------- | ------- |
| Service Order lifecycle     | 90%     |
| Customer & TaxId validation | 85%     |
| Quote calculation           | 90%     |
| Parts inventory             | 85%     |
| Status transitions          | 90%     |

---

## Configuration

```bash
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/workshop
JWT_SECRET=your-secret-here
```

## NOTES

### Current Status (2025-03-25)

- **Greenfield project** - Only NestJS boilerplate exists in `src/`
- No DDD structure implemented yet (no domain/, application/, infrastructure/, interfaces/)
- No API endpoints beyond default `/` endpoint
- No authentication module
- No database schema/migrations

### Known Gaps

- `docker-compose.yml` referenced in README but not present
- DDD directory structure needs to be created
- Domain value objects (TaxId, LicensePlate, Money, SOStatus) not implemented

---

## Related Context

- `/home/trigo/.config/opencode/context/project-intelligence/technical-domain.md`
- `/home/trigo/.config/opencode/context/core/standards/code-quality.md`
