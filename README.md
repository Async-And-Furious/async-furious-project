# Sistema de Gestão para Oficina Mecânica

> API RESTful para gerenciamento de ordens de serviço, clientes, veículos e estoque de peças.

## 🏗️ Objetivo do Projeto

Este projeto é um sistema backend para **gestão integrada de oficina mecânica**, desenvolvido com arquitetura DDD (Domain-Driven Design) e baseado no PRD (Product Requirements Document).

### Problema que Resolve

- **Centralização**: Substitui planilhas e notas manuais por um sistema unificado
- **Rastreamento**: Clientes acompanham o status da ordem de serviço via API pública
- **Controle de Estoque**: Gerenciamento de peças e alertas de estoque mínimo
- **Validação**: CPF/CNPJ e plaque veiculares seguem padrões brasileiros

### Funcionalidades Principais

| Módulo                | Descrição                                                              |
| --------------------- | ---------------------------------------------------------------------- |
| **Ordens de Serviço** | Criação, ciclo de vida (RECEIVED → DELIVERED), aprovação de orçamentos |
| **Clientes**          | Cadastro com validação de CPF/CNPJ                                     |
| **Veículos**          | Cadastro com validação de placa brasileira                             |
| **Peças**             | CRUD completo com controle de estoque                                  |
| **Autenticação**      | JWT para endpoints administrativos                                     |
| **Rastreamento**      | API pública para consulta de status                                    |

---

## 🛠️ Tecnologias

| Camada         | Tecnologia      |
| -------------- | --------------- |
| Framework      | NestJS 11.x     |
| Linguagem      | TypeScript 5.x  |
| Banco de Dados | PostgreSQL 15   |
| ORM            | Drizzle ORM     |
| Autenticação   | JWT + bcrypt    |
| Documentação   | Swagger/OpenAPI |
| Container      | Docker Compose  |

---

## 📋 Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- PostgreSQL 15 (ou via Docker)

---

## 🚀 Como Executar Localmente

### 1. Clonar o repositório

```bash
git clone <repo-url>
cd async-furious-project
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workshop
JWT_SECRET=sua-chave-secreta-aqui
```

### 3. Iniciar com Docker Compose

```bash
docker-compose up -d
```

Isso inició:

- PostgreSQL na porta 5432
- Aplicação na porta 3000

### 4. Sem Docker (alternativo)

```bash
# Instalar dependências
npm install

# Executar migrações (se houver)
npm run migration:run

# Iniciar desenvolvimento
npm run start:dev
```

---

## 📚 Documentação da API

Após iniciar o projeto, acesso a documentação Swagger em:

```
http://localhost:3000/api/docs
```

### Endpoints Principais

#### Autenticação

| Método | Endpoint             | Descrição       |
| ------ | -------------------- | --------------- |
| POST   | `/api/v1/auth/login` | Obter token JWT |

#### Ordens de Serviço (Admin)

| Método | Endpoint                            | Descrição        |
| ------ | ----------------------------------- | ---------------- |
| POST   | `/api/v1/service-orders`            | Criar OS         |
| GET    | `/api/v1/service-orders`            | Listar OS        |
| GET    | `/api/v1/service-orders/:id`        | Detalhar OS      |
| PATCH  | `/api/v1/service-orders/:id/status` | Atualizar status |

#### Ordens de Serviço (Público)

| Método | Endpoint              | Descrição        |
| ------ | --------------------- | ---------------- |
| GET    | `/api/v1/track/:soId` | Consultar status |

#### Clientes (Admin)

| Método | Endpoint                | Descrição |
| ------ | ----------------------- | --------- |
| POST   | `/api/v1/customers`     | Cadastrar |
| GET    | `/api/v1/customers`     | Listar    |
| GET    | `/api/v1/customers/:id` | Detalhar  |

#### Veículos (Admin)

| Método | Endpoint               | Descrição |
| ------ | ---------------------- | --------- |
| POST   | `/api/v1/vehicles`     | Cadastrar |
| GET    | `/api/v1/vehicles/:id` | Detalhar  |

#### Peças (Admin)

| Método | Endpoint                  | Descrição         |
| ------ | ------------------------- | ----------------- |
| POST   | `/api/v1/parts`           | Cadastrar         |
| GET    | `/api/v1/parts`           | Listar            |
| PATCH  | `/api/v1/parts/:id/stock` | Atualizar estoque |

---

## 🧪 Executar Tests

```bash
# Todos os testes
npm run test

# Com cobertura
npm run test:cov

# Modo watch
npm run test:watch

# Teste específico por nome
npm run test -- --testNamePattern="Customer"
```

### Cobertura Mínima (segundo PRD)

| Domínio               | Mínimo |
| --------------------- | ------ |
| Ciclo de vida da OS   | 90%    |
| Validação de CPF/CNPJ | 85%    |
| Cálculo de orçamento  | 90%    |
| Controle de estoque   | 85%    |
| Transições de status  | 90%    |

---

## 📁 Estrutura do Projeto (DDD)

```
src/
├── domain/                    # Camada de domínio
│   ├── customer/              # Agregado cliente
│   │   ├── entities/
│   │   └── value-objects/    # TaxId (CPF/CNPJ)
│   ├── vehicle/              # Agregado veículo
│   │   └── value-objects/    # LicensePlate
│   ├── service-order/       # Agregado OS
│   │   ├── entities/
│   │   ├── value-objects/    # SOStatus, Quote
│   │   └── events/           # Eventos de domínio
│   ├── parts/                # Agregado peças
│   └── shared/               # Value objects compartilhados
├── application/               # Casos de uso, DTOs
├── infrastructure/            # Persistência, segurança
└── interfaces/               # Controllers REST
```

---

## 🔐 Autenticação

- Endpoints `/api/v1/*` (exceto `/track/*`) exigem token JWT
- Endpoints `/api/v1/track/*` são públicos (sem autenticação)
- Token padrão: Bearer com expiry de 1 hora

---

## 📝 Padrões de Código

Consulte [AGENTS.md](./AGENTS.md) para:

- Convenções de nomenclatura
- Padrões de código TypeScript/NestJS
- Políticas de imports e formatação

---

## 📄 Licença

Privado - Todos os direitos reservados
