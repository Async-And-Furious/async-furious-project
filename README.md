# Sistema de Gestão para Oficina Mecânica

> API RESTful para gerenciamento de ordens de serviço, clientes, veículos e estoque de peças.

## Objetivo do Projeto

Backend para **gestão integrada de oficina mecânica**, desenvolvido como Tech Challenge da pós-graduação em Arquitetura de Software (15SOAT — FIAP). Arquitetura: Clean Architecture + DDD.

### Problema que Resolve

- **Centralização**: Substitui planilhas e processos manuais por um sistema unificado
- **Rastreamento**: Clientes acompanham o status da ordem de serviço em tempo real
- **Controle de Estoque**: Gerenciamento de peças com alertas de estoque mínimo e pedidos a fornecedores
- **Validação**: CPF/CNPJ e placas veiculares seguem padrões brasileiros

### Funcionalidades Principais

| Módulo                | Descrição                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| **Ordens de Serviço** | Ciclo de vida completo (RECEIVED → DELIVERED), orçamento e aprovação pelo cliente |
| **Clientes**          | CRUD com validação de CPF/CNPJ                                                 |
| **Veículos**          | CRUD com validação de placa brasileira                                         |
| **Serviços**          | Catálogo de serviços oferecidos pela oficina                                   |
| **Peças e Insumos**   | CRUD com controle de estoque e pedidos a fornecedores                          |
| **Pagamentos**        | Registro de pagamentos com disparo de entrega automática                       |
| **Autenticação**      | JWT com papéis ADMIN, RECEPCIONISTA e MECÂNICO                                 |

---

## Tecnologias

| Camada         | Tecnologia           |
| -------------- | -------------------- |
| Framework      | NestJS 10.x          |
| Linguagem      | TypeScript 5.x       |
| Banco de Dados | PostgreSQL 15        |
| ORM            | Prisma               |
| Autenticação   | JWT + bcrypt         |
| Documentação   | Swagger / OpenAPI    |
| Container      | Docker Compose       |
| Testes         | Jest                 |
| Segurança DAST | OWASP ZAP            |

Utilizamos Node.js com NestJS pela arquitetura modular e suporte nativo a injeção de dependência, PostgreSQL pela robustez e consistência transacional, e Prisma como ORM por sua tipagem forte integrada ao TypeScript, garantindo segurança e produtividade no desenvolvimento.
---

## Pré-requisitos

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker e Docker Compose

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
JWT_SECRET="sua-chave-secreta-aqui"
PORT=5000
BCRYPT_SALT_ROUNDS=10
ALLOWED_ORIGINS=http://localhost:5000
SEED_ADMIN_EMAIL="seu-email-admin"
SEED_ADMIN_PASSWORD="sua-senha-admin"
```

### 3. Iniciar com Docker (recomendado)

```bash
# Sobe somente o PostgreSQL
docker compose -f docker-compose.dependencies.yml up -d

# Roda migrations + seed + aplicação em modo watch
pnpm dev:local
```

### 4. Ou iniciar com stack completa

```bash
# Sobe PostgreSQL + aplicação
docker compose up -d
```

A aplicação ficará disponível em `http://localhost:5000`.

---

## Documentação da API

Após iniciar o projeto, acesse o Swagger em:

```
http://localhost:5000/api/docs
```

### Rotas

#### Autenticação (`/api/v1/auth`)

| Método | Endpoint         | Acesso           | Descrição               |
| ------ | ---------------- | ---------------- | ----------------------- |
| POST   | `/auth/register` | ADMIN            | Registrar novo usuário  |
| POST   | `/auth/login`    | Público          | Fazer login, retorna JWT |

#### Clientes (`/api/v1/clientes`)

| Método | Endpoint         | Acesso        | Descrição          |
| ------ | ---------------- | ------------- | ------------------ |
| POST   | `/clientes`      | RECEPCIONISTA | Criar cliente      |
| GET    | `/clientes`      | Autenticado   | Listar clientes    |
| GET    | `/clientes/:id`  | Autenticado   | Detalhar cliente   |
| PATCH  | `/clientes/:id`  | RECEPCIONISTA | Atualizar cliente  |
| DELETE | `/clientes/:id`  | ADMIN         | Deletar cliente    |

#### Veículos (`/api/v1/veiculos`)

| Método | Endpoint         | Acesso        | Descrição          |
| ------ | ---------------- | ------------- | ------------------ |
| POST   | `/veiculos`      | RECEPCIONISTA | Criar veículo      |
| GET    | `/veiculos`      | Autenticado   | Listar veículos    |
| GET    | `/veiculos/:id`  | Autenticado   | Detalhar veículo   |
| PATCH  | `/veiculos/:id`  | RECEPCIONISTA | Atualizar veículo  |
| DELETE | `/veiculos/:id`  | ADMIN         | Deletar veículo    |

#### Serviços (`/api/v1/servicos`)

| Método | Endpoint         | Acesso      | Descrição          |
| ------ | ---------------- | ----------- | ------------------ |
| POST   | `/servicos`      | ADMIN       | Criar serviço      |
| GET    | `/servicos`      | Autenticado | Listar serviços    |
| GET    | `/servicos/:id`  | Autenticado | Detalhar serviço   |
| PATCH  | `/servicos/:id`  | ADMIN       | Atualizar serviço  |
| DELETE | `/servicos/:id`  | ADMIN       | Deletar serviço    |

#### Ordens de Serviço (`/api/v1/ordens-servico`)

| Método | Endpoint                              | Acesso        | Descrição                                      |
| ------ | ------------------------------------- | ------------- | ---------------------------------------------- |
| POST   | `/ordens-servico`                     | RECEPCIONISTA | Criar OS                                       |
| GET    | `/ordens-servico`                     | Autenticado   | Listar OSs                                     |
| GET    | `/ordens-servico/:id`                 | Autenticado   | Detalhar OS                                    |
| GET    | `/ordens-servico/:id/status`          | Autenticado   | Consultar status (endpoint público para cliente) |
| PATCH  | `/ordens-servico/:id`                 | ADMIN         | Atualizar OS                                   |
| DELETE | `/ordens-servico/:id`                 | ADMIN         | Deletar OS                                     |
| PATCH  | `/ordens-servico/:id/assumir`         | ADMIN         | Mecânico assume OS → UNDER_DIAGNOSIS           |
| PATCH  | `/ordens-servico/:id/analisar`        | ADMIN         | Registrar análise diagnóstica                  |
| PATCH  | `/ordens-servico/:id/servicos-insumos`| ADMIN         | Gerar orçamento → AWAITING_APPROVAL            |
| PATCH  | `/ordens-servico/:id/orcamento/aprovar` | Público     | Cliente aprova orçamento → IN_PROGRESS         |
| PATCH  | `/ordens-servico/:id/orcamento/recusar` | Público     | Cliente recusa → CLOSED_WITHOUT_EXECUTION      |
| PATCH  | `/ordens-servico/:id/finalizar-execucao` | ADMIN      | Mecânico finaliza → FINISHED                   |
| PATCH  | `/ordens-servico/:id/registrar-entrega` | RECEPCIONISTA | Registrar entrega → DELIVERED               |

#### Peças e Insumos (`/api/v1/pecas`)

| Método | Endpoint                                   | Acesso      | Descrição                          |
| ------ | ------------------------------------------ | ----------- | ---------------------------------- |
| POST   | `/pecas`                                   | ADMIN       | Criar peça/insumo                  |
| GET    | `/pecas`                                   | Autenticado | Listar peças/insumos               |
| GET    | `/pecas/:id`                               | Autenticado | Detalhar peça/insumo               |
| PATCH  | `/pecas/:id`                               | ADMIN       | Atualizar peça/insumo              |
| PATCH  | `/pecas/:id/estoque`                       | ADMIN       | Atualizar estoque                  |
| DELETE | `/pecas/:id`                               | ADMIN       | Deletar peça/insumo                |
| POST   | `/pecas/fornecedor/solicitar`              | ADMIN       | Solicitar peças a fornecedor       |
| PATCH  | `/pecas/fornecedor/pedidos/:pedidoId/receber` | ADMIN    | Confirmar recebimento de peças     |

#### Pagamentos (`/api/v1/pagamentos`)

| Método | Endpoint               | Acesso      | Descrição                                    |
| ------ | ---------------------- | ----------- | -------------------------------------------- |
| POST   | `/pagamentos/registrar`| Autenticado | Registrar pagamento → dispara entrega da OS  |

---

## Ciclo de Vida da Ordem de Serviço

```
RECEIVED
  └─► UNDER_DIAGNOSIS
        └─► AWAITING_APPROVAL
              ├─► CLOSED_WITHOUT_EXECUTION  (orçamento recusado)
              └─► IN_PROGRESS
                    ├─► AWAITING_PARTS  (peças indisponíveis)
                    │     └─► IN_PROGRESS  (peças reservadas)
                    └─► FINISHED
                          └─► DELIVERED
```

---

## Autenticação e Papéis

Todos os endpoints (exceto `@Public()`) exigem header `Authorization: Bearer <token>`.

| Role            | Permissões principais                                               |
| --------------- | ------------------------------------------------------------------- |
| `ADMIN`         | Acesso total: CRUD serviços e peças, ações do mecânico na OS        |
| `RECEPCIONISTA` | Criar/atualizar clientes e veículos, criar OS, registrar entrega    |

Token JWT expira em **1 hora**.

---

## Testes

```bash
# Todos os testes unitários
pnpm test

# Com relatório de cobertura
pnpm test:cov

# Modo watch
pnpm test:watch

# Testes E2E
pnpm test:e2e

# Arquivo específico
pnpm test -- src/modules/cadastro/application/use-cases/cliente.use-cases.spec.ts

# Por nome de teste
pnpm test -- --testNamePattern="CreateClienteUseCase"
```

### Thresholds de Cobertura

| Métrica    | Mínimo |
| ---------- | ------ |
| Statements | 85%    |
| Lines      | 85%    |
| Functions  | 80%    |
| Branches   | 80%    |

---

## Estrutura do Projeto

```
src/
├── auth/                    # JWT, guards, estratégias, decorators
├── modules/
│   ├── cadastro/            # Clientes, Veículos, Serviços
│   │   ├── domain/          # Entidades, VOs, interfaces de repositório
│   │   ├── application/     # Use cases
│   │   ├── infrastructure/  # Prisma repositories
│   │   └── presentation/    # Controllers, DTOs
│   ├── ordem-servico/       # Ordens de Serviço + Orçamentos
│   ├── pecas-insumos/       # Peças, estoque, pedidos a fornecedores
│   └── financeiro/          # Pagamentos
└── shared/
    ├── domain/              # DomainEvent base, exceções, interfaces
    └── infrastructure/      # PrismaService, EmissorEventos, filtros
```

Cada módulo segue a regra de dependência: `presentation → application → domain ← infrastructure`.

---

## Comandos Úteis

```bash
# Desenvolvimento (sobe container + migrate + seed + watch)
pnpm dev

# Desenvolvimento sem container
pnpm dev:local

# Reset completo do banco
pnpm dev:reset-db

# Build de produção
pnpm build

# Lint com auto-fix
pnpm lint

# Formatar código
pnpm format
```

---

## Convenções de Código

Consulte [AGENTS.md](./AGENTS.md) para convenções de nomenclatura, padrões TypeScript/NestJS e políticas de imports.

---

## Licença

Privado — Todos os direitos reservados.
