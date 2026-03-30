# AGENTS.md - Guia para Agentes de Código

> Este arquivo contém diretrizes para agentes de código que operam neste repositório.

---

## 🚦 Comandos de Build, Lint e Test

### Comandos Principais

```bash
# Desenvolvimento (inicia PostgreSQL + aplicação)
npm run dev

# Build de produção
npm run build

# Iniciar produção
npm run prod
```

### Testes

```bash
# Todos os testes
npm run test

# Com cobertura de código
npm run test:cov

# Modo watch (re executa ao modificar)
npm run test:watch

# Teste específico por nome
npm run test -- --testNamePattern="Customer"

# Teste específico por arquivo
npm run test -- src/modules/infrastructure/auth/auth.service.spec.ts

# Debug de teste
npm run test:debug

# Testes E2E
npm run test:e2e
```

### Lint e Formatação

```bash
# Executar ESLint com auto-fix
npm run lint

# Formatar com Prettier
npm run format
```

---

## 📝 Convenções de Código

### Estrutura de Arquivos (DDD)

```
src/
├── modules/
│   ├── domain/
│   │   └── [entidade]/
│   │       ├── [entidade].controller.ts   # Routes
│   │       ├── [entidade].service.ts      # Lógica de negócio
│   │       ├── [entidade].module.ts       # Registro do módulo
│   │       └── dto/                       # Data Transfer Objects
│   └── infrastructure/
│       ├── auth/                          # JWT, guards, estratégias
│       └── database/                      # Prisma/ORM
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

### Nomeclatura

| Tipo          | Convenção                  | Exemplo                         |
| ------------- | -------------------------- | ------------------------------- |
| Arquivos      | kebab-case                 | `customer.service.ts`           |
| Classes       | PascalCase                 | `CustomerService`               |
| Interfaces    | PascalCase                 | `CreateCustomerDto`             |
| Métodos       | camelCase                  | `findAll()`, `createCustomer()` |
| Variáveis     | camelCase                  | `const customerId`              |
| Constantes    | UPPER_SNAKE_CASE           | `DEFAULT_PAGE_SIZE`             |
| Enums         | PascalCase + valores UPPER | `UserRole.ADMIN`                |
| Valor Objects | PascalCase                 | `TaxId`, `LicensePlate`         |

### Imports

```typescript
// 1. Imports externos (NestJS, libs)
import { Controller, Get, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 2. Imports internos (módulos locais)
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/customer.dto';

// 3. Imports de tipos
import type { AuthUser } from '../auth/types/auth.types';

// Use paths alias quando disponível
import { CustomerEntity } from '@/modules/domain/customers/entities/customer.entity';
```

### Typescript

```typescript
// ✅ Use tipos explícitos para retornos
async findAll(): Promise<Customer[]> { }

// ✅ Use interfaces para DTOs
interface CreateCustomerDto {
  name: string;
  email: string;
  taxId: string;
}

// ✅ Use type para unions/tuplas
type OrderStatus = 'RECEIVED' | 'IN_PROGRESS' | 'DELIVERED';

// ❌ Evite 'any' - use 'unknown' se necessário
function process(data: unknown): string {
  if (typeof data === 'string') return data;
  return '';
}
```

### Decoradores NestJS

```typescript
// Controllers - use prefixo claro
@Controller('customers')
@Controller('auth')
@Controller('service-orders')

// Roteamento - HTTP method adequado
@Get()     // Ler / Listar
@Post()    // Criar
@Patch()   // Atualização parcial
@Put()     // Substituição completa
@Delete()  // Remover

// Guards e autenticação
@UseGuards(JwtAuthGuard)
@UseGuards(RolesGuard)
@Roles('admin')  // RBAC
```

### Error Handling

```typescript
// ✅ Use exceptions nativos do NestJS
import { NotFoundException, BadRequestException } from '@nestjs/common';

async findOne(id: string) {
  const customer = await this.customerRepository.find(id);
  if (!customer) {
    throw new NotFoundException(`Customer ${id} not found`);
  }
  return customer;
}

// ✅ Tratamento centralizado para errosknown
catch (error) {
  if (error instanceof ValidationError) {
    throw new BadRequestException(error.message);
  }
  throw new InternalServerErrorException('Unexpected error');
}
```

### Validação

```typescript
// Use class-validator para DTOs
import { IsString, IsEmail, IsOptional, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @MaxLength(20)
  phone?: string;
}
```

### Banco de Dados (Prisma)

```typescript
// Schema naming: snake_case para tabelas/campos
model Customer {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  orders    Order[]
}
```

### Comments e Documentação

```typescript
/**
 * Creates a new customer in the system.
 *
 * @param dto - Customer creation data
 * @returns Created customer entity
 * @throws BadRequestException if email already exists
 */
async create(dto: CreateCustomerDto): Promise<Customer> { }
```

---

## 🎯 Padrões de Testes

### Estrutura de Teste

```typescript
describe('CustomerService', () => {
  let service: CustomerService;
  let repository: jest.Mocked<CustomerRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CustomerService, { provide: CustomerRepository, useFactory: () => ({}) }],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    repository = module.get(CustomerRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Nomenclatura de Testes

```typescript
describe('CustomerService', () => {
  describe('create', () => {
    it('should create a customer with valid data', () => {});
    it('should throw BadRequestException for duplicate email', () => {});
  });
});
```

---

## 📋 Configurações do Projeto

### Prettier (`.prettierrc`)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true
}
```

### TypeScript (`tsconfig.json`)

- Target: ES2023
- Strict mode: enabled
- decorators: enabled
- Path alias: `@/*` → `./src/*`

---

## ⚠️ Regras Importantes

1. **Nunca use `as any`** - Use tipos adequados ou `unknown`
2. **Nunca use `@ts-ignore`** - Corrija o tipo ou use verificação
3. **Sempre valide entrada** - Use class-validator em DTOs
4. **Trate erros adequadamente** - Use exceptions do NestJS
5. **Não commite senhas** - Use `.env` e `.gitignore`
6. **Testes são obrigatórios** - Mantenha cobertura mínima de 85%

---

## 📚 Recursos

- NestJS: https://docs.nestjs.com/
- Prisma: https://www.prisma.io/docs/
- Class Validator: https://github.com/typestack/class-validator
