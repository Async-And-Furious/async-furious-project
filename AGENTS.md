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
npm run test -- --testNamePattern="Cliente"

# Teste específico por arquivo
npm run test -- src/modules/clientes/application/use-cases/cliente.use-cases.spec.ts

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

## 🏗️ Arquitetura (Clean Architecture)

### Estrutura de Diretórios

```
src/
├── modules/
│   └── [modulo]/
│       ├── domain/                 # Regras de negócio (ZERO dependências externas)
│       │   ├── entities/           # Entidades (objetos de negócio)
│       │   │   └── cliente.entity.ts
│       │   └── interfaces/         # Contratos (repositórios)
│       │       └── i-cliente.repository.ts
│       ├── application/            # Casos de uso
│       │   └── use-cases/
│       │       └── cliente.use-cases.ts
│       ├── infrastructure/         # Implementações externas
│       │   └── repositories/
│       │       └── prisma-cliente.repository.ts
│       ├── presentation/           # Adaptadores de interface
│       │   ├── controllers/
│       │   │   └── cliente.controller.ts
│       │   └── dto/
│       │       └── cliente.dto.ts
│       └── [modulo].module.ts
├── shared/                         # Recursos compartilhados
│   ├── auth/                       # Autenticação/JWT
│   └── infrastructure/
│       └── database/               # Prisma
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

### Fluxo de Dependências

```
presentation → application → domain
                              ↕
                         infrastructure (implementa interfaces do domain)
```

**Regras:**

- Domain: SEM dependências externas (sem Prisma, sem JWT)
- Application: Depende APENAS do Domain
- Infrastructure: Implementa interfaces do Domain
- Presentation: Depende do Application

---

## 📝 Convenções de Código

### Estrutura de Arquivos

| Camada                         | Conteúdo                                        |
| ------------------------------ | ----------------------------------------------- |
| `domain/entities/`             | Entidades de negócio (`Cliente`, `Veiculo`)     |
| `domain/interfaces/`           | Contratos de repositório (`IClienteRepository`) |
| `application/use-cases/`       | Casos de uso (`CreateClienteUseCase`)           |
| `infrastructure/repositories/` | Implementações (`PrismaClienteRepository`)      |
| `presentation/controllers/`    | Controladores HTTP                              |
| `presentation/dto/`            | DTOs de request/response                        |

### Nomeclatura

| Tipo       | Convenção                  | Exemplo                                     |
| ---------- | -------------------------- | ------------------------------------------- |
| Arquivos   | kebab-case                 | `cliente.controller.ts`                     |
| Classes    | PascalCase                 | `ClienteRepository`, `CreateClienteUseCase` |
| Interfaces | PascalCase com prefixo I   | `IClienteRepository`                        |
| Entidades  | PascalCase                 | `Cliente`, `Veiculo`                        |
| Métodos    | camelCase                  | `findAll()`, `create()`                     |
| Variáveis  | camelCase                  | `const clienteId`                           |
| Constantes | UPPER_SNAKE_CASE           | `DEFAULT_PAGE_SIZE`                         |
| Enums      | PascalCase + valores UPPER | `UserRole.ADMIN`                            |

### Imports

```typescript
// 1. Imports externos (NestJS, libs)
import { Controller, Get, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 2. Imports internos (mesma camada)
import { CreateClienteUseCase } from '../application/use-cases/cliente.use-cases';
import { Cliente } from '../domain/entities/cliente.entity';

// 3. Imports de tipos
import type { AuthUser } from '../../../shared/auth/types/auth.types';

// Use paths alias quando disponível
import { Cliente } from '@/modules/clientes/domain/entities/cliente.entity';
```

### TypeScript

```typescript
// ✅ Use tipos explícitos para retornos
async findAll(): Promise<Cliente[]> { }

// ✅ Use interfaces para contratos
interface IClienteRepository {
  create(data: CreateClienteDto): Promise<Cliente>;
}

// ✅ Use type para unions/tuplas
type OrderStatus = 'RECEIVED' | 'IN_PROGRESS' | 'DELIVERED';

// ❌ Evite 'any' - use 'unknown' se necessário
function process(data: unknown): string {
  if (typeof data === 'string') return data;
  return '';
}

// ✅ Retornos de use cases referenciam entidade
export class CreateClienteUseCase {
  async execute(data: CreateClienteDto): Promise<Cliente> { }
}
```

### Decoradores NestJS

```typescript
// Controllers - use prefixo claro em português
@Controller('clientes')
@Controller('veiculos')
@Controller('ordens-servico')

// Roteamento - HTTP method adequado
@Get()     // Ler / Listar
@Post()    // Criar
@Patch()   // Atualização parcial
@Put()     // Substituição completa
@Delete()  // Remover

// Autenticação
@UseGuards(JwtAuthGuard)
@UseGuards(RolesGuard)
@Roles('admin')

// params de rota
@Param('id', ParseUUIDPipe) id: string
```

---

## 🎯 Error Handling

```typescript
// ✅ Use exceptions nativos do NestJS
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';

async findOne(id: string) {
  const cliente = await this.repository.findOne(id);
  if (!cliente) {
    throw new NotFoundException(`Cliente ${id} not found`);
  }
  return cliente;
}

// ✅ Tratamento centralizado
catch (error) {
  if (error instanceof ValidationError) {
    throw new BadRequestException(error.message);
  }
  throw new InternalServerErrorException('Unexpected error');
}
```

---

## 💾 Banco de Dados (Prisma)

```prisma
// Schema naming: snake_case para tabelas/campos
model Customer {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  vehicles  Vehicle[]
}
```

```typescript
// Repositório implementa interface do domain
@Injectable()
export class PrismaClienteRepository implements IClienteRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClienteDto): Promise<Cliente> {
    return (await this.prisma.customer.create({ data })) as unknown as Cliente;
  }
}
```

---

## 🧪 Padrões de Testes

### Estrutura de Teste

```typescript
describe('CreateClienteUseCase', () => {
  let useCase: CreateClienteUseCase;
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
    } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new CreateClienteUseCase(mockRepository);
  });

  it('should create a cliente with valid data', async () => {
    const input = {
      name: 'Test',
      email: 'test@test.com',
      tax_id: '12345678901',
      tax_id_type: 'CPF' as const,
    };
    mockRepository.create.mockResolvedValue({ id: '1', ...input } as Cliente);

    const result = await useCase.execute(input);

    expect(result.name).toBe('Test');
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });
});
```

---

## 📋 Configurações

### Prettier

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

### TypeScript

- Target: ES2023
- Strict mode: enabled
- decorators: enabled
- Path alias: `@/*` → `./src/*`

---

## ⚠️ Regras Importantes

1. **Domain SEM dependências externas** - Não importe PrismaService, JwtService no domain
2. **Use repository interface** - Domain define contrato, infrastructure implementa
3. **Nunca use `as any`** - Use tipos adequados ou `unknown`
4. **Nunca use `@ts-ignore`** - Corrija o tipo ou use verificação
5. **Sempre valide entrada** - Use class-validator em DTOs (presentation/dto)
6. **Trate erros adequadamente** - Use exceptions do NestJS
7. **Não commite senhas** - Use `.env` e `.gitignore`
8. **Testes são obrigatórios** - Mantenha cobertura mínima de 85%
9. **Parâmetros não usados** - Use prefixo `_` (ex: `@CurrentUser() _user`)

---

## 📚 Recursos

- NestJS: https://docs.nestjs.com/
- Prisma: https://www.prisma.io/docs/
- Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
