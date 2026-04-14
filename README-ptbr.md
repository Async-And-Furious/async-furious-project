# Sistema de Gestão para Oficina Mecânica

> API RESTful para gerenciamento de ordens de serviço, clientes, veículos e estoque de peças.

## 🏗️ Objetivo do Projeto

Este projeto é um sistema backend para **gestão integrada de oficina mecânica**, desenvolvido com arquitetura DDD (Domain-Driven Design) e baseado no PRD (Product Requirements Document).

### Problema que Resolve

- **Centralização**: Substitui planilhas e notas manuais por um sistema unificado
- **Rastreamento**: Clientes acompanham o status da ordem de serviço via API pública
- **Controle de Estoque**: Gerenciamento de peças e alertas de estoque mínimo
- **Validação**: CPF/CNPJ e placas veiculares seguem padrões brasileiros

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
| ORM            | Prisma          |
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
docker compose up -d
```

Isso inicia:

- PostgreSQL na porta 5432
- Aplicação na porta 3000

### 4. Sem Docker (alternativo)

```bash
# Instalar dependências
npm install

# Executar migrações
npx prisma migrate dev

# Iniciar desenvolvimento
npm run start:dev
```

---

## 📚 Documentação da API

Após iniciar o projeto, acessa a documentação Swagger em:

```
http://localhost:3000/api/docs
```

### Rotas Principais

#### Raiz

| Método | Endpoint | Descrição         |
| ------ | -------- | ----------------- |
| GET    | `/`      | Health check root |

#### Autenticação

| Método | Endpoint         | Descrição              |
| ------ | ---------------- | ---------------------- |
| POST   | `/auth/register` | Registrar novo usuário |
| POST   | `/auth/login`    | Obter token JWT        |

#### Clientes (Protegido - JWT)

| Método | Endpoint         | Descrição    | Acesso       |
| ------ | ---------------- | ------------ | ------------ |
| POST   | `/customers`     | Criar        | Apenas admin |
| GET    | `/customers`     | Listar todos | Autenticado  |
| GET    | `/customers/:id` | Detalhar     | Autenticado  |
| PATCH  | `/customers/:id` | Atualizar    | Apenas admin |
| DELETE | `/customers/:id` | Excluir      | Apenas admin |

#### Em Breve

| Módulo            | Endpoint          | Status   |
| ----------------- | ----------------- | -------- |
| Ordens de Serviço | `/service-orders` | Em breve |
| Veículos          | `/vehicles`       | Em breve |
| Peças             | `/parts`          | Em breve |
| Rastreamento      | `/track/:soId`    | Em breve |

---

## 🔐 Autenticação

- Endpoints em `/customers` exigem token JWT (exceto listagem)
- Endpoints `/auth/*` são públicos
- Token: Bearer com expiração de 1 hora

---

## 🧪 Executar Testes

```bash
# Todos os testes
npm run test

# Com cobertura
npm run test:cov

# Modo watch
npm run test:watch

# Teste específico por nome
npm run test -- --testNamePattern="Customer"

# Arquivo de teste específico
npm run test -- src/modules/infrastructure/auth/auth.service.spec.ts
```

### Comandos de Build e Lint

```bash
# Build de produção
npm run build

# Formatar código
npm run format

# Lint com auto-fix
npm run lint
```

### Cobertura Mínima (conforme PRD)

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
├── modules/
│   ├── domain/
│   │   └── customers/          # Agregado cliente
│   │       ├── customer.controller.ts
│   │       ├── customer.service.ts
│   │       ├── customer.module.ts
│   │       └── dto/
│   └── infrastructure/
│       ├── auth/                # Autenticação e autorização
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── guards/
│       │   └── strategies/
│       └── database/            # Conexão Prisma
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

---

## 📝 Convenções de Código

Consulte [AGENTS.md](./AGENTS.md) para:

- Convenções de nomenclatura
- Padrões de código TypeScript/NestJS
- Políticas de imports e formatação
- Configurações ESLint/Prettier

---

## 📄 Licença

Privado - Todos os direitos reservados
