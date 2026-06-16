# AI Architecture Handbook

Source: `docs/ai/project-context.md`

Use this as the fastest operational reference for implementation agents. Prefer these notes over broad repo browsing when you need the controlling rule, aggregate, or lifecycle state.

## Bounded Context Cheat Sheet

- Cadastro
  - Scope: clientes, veículos, serviços
  - Owns: validation and CRUD for identity and catalog data
  - Uses: serves Ordem de Serviço with customer, vehicle, and service data
- Ordem de Serviço
  - Scope: lifecycle, orçamento, status, tempo médio
  - Owns: orchestration of the OS flow and business transitions
  - Uses: coordinates with Cadastro, Peças e Insumos, and Financeiro
- Peças e Insumos
  - Scope: estoque, reservas, fornecedor, reposição
  - Owns: inventory availability and reservation behavior
  - Uses: reacts to OS needs and stock events
- Financeiro
  - Scope: pagamento
  - Owns: payment registration and delivery trigger
  - Uses: publishes events consumed by Ordem de Serviço
- Auth
  - Scope: login, JWT, roles
  - Owns: authentication and authorization
- Health
  - Scope: health check only
  - Owns: no domain rules

## Aggregate Cheat Sheet

- OrdemDeServico
  - Aggregate root for the OS flow
  - Core invariants: status-gated transitions only
  - Internal relations: OsPeca; Orcamento appears as part of the OS model
- Cliente
  - Aggregate root for customer identity
  - Invariants: id required, nome required, email valid, telefone valid when present, documento valid by type
- Veiculo
  - Aggregate root for vehicle data
  - Invariants: marca, modelo, ano, and valid Brazilian plate
- Servico
  - Aggregate root for service catalog entries
  - Invariants: catalog-style entity, no complex lifecycle
- PecaInsumo
  - Aggregate root for inventory management
  - Invariants: stock cannot go negative, received quantity must be positive, low stock follows threshold rules
- PedidoFornecedor
  - Aggregate root for supplier orders
  - Invariants: state alternates between PENDENTE and RECEBIDO, items bind piece and quantity
- Pagamento
  - Aggregate root for payment records
  - Invariants: value must be positive, registration updates internal status

## Domain Event Cheat Sheet

- OrdemServicoCriada
  - Fires on OS creation
  - Effect: confirms RECEIVED and starts downstream policies
- OrdemServicoAssumida
  - Fires when a mechanic takes the OS
  - Effect: moves to UNDER_DIAGNOSIS
- StatusAtualizadoEmDiagnostico
  - Fires after diagnosis confirmation
  - Effect: advances the diagnostic/orçamento flow
- ServicosEInsumosListados
  - Fires when services and parts are listed
  - Effect: feeds orçamento generation
- OrcamentoGerado
  - Fires when budget is computed
  - Effect: prepares client approval
- OrcamentoEnviado
  - Fires when orçamento is sent
  - Effect: moves OS to AWAITING_APPROVAL
- OrcamentoAprovado
  - Fires on client approval
  - Effect: allows execution to start
- OrcamentoAprovadoComPecas
  - Fires when approved budget includes parts
  - Effect: triggers stock verification/reservation
- OsSemPecasConfirmada
  - Fires when approved budget has no required parts
  - Effect: starts execution directly
- PecasReservadas
  - Fires when inventory reservation/discount succeeds
  - Effect: enables IN_PROGRESS when applicable
- PecasIndisponiveis
  - Fires when stock is insufficient
  - Effect: moves OS to AWAITING_PARTS
- StatusAtualizadoAguardandoPecas
  - Fires after shortage handling
  - Effect: keeps OS waiting for replenishment
- StatusAtualizadoEmExecucao
  - Fires when work starts
  - Effect: starts execution timing
- ServicoConcluidoPeloMecanico
  - Fires when mechanic completes work
  - Effect: moves OS to FINISHED
- StatusAtualizadoFinalizada
  - Fires after service completion
  - Effect: closes timing and prepares delivery
- PagamentoRegistrado
  - Fires when payment is recorded
  - Effect: enables DELIVERED once OS is FINISHED
- StatusAtualizadoEntregue
  - Fires when the vehicle is delivered
  - Effect: closes the operational cycle
- OrcamentoRecusado
  - Fires when client rejects the budget
  - Effect: moves OS to CLOSED_WITHOUT_EXECUTION
- StatusAtualizadoEncerradaSemExecucao
  - Fires after refusal handling
  - Effect: ends the OS without execution

## Order Lifecycle Cheat Sheet

- Canonical path: RECEIVED -> UNDER_DIAGNOSIS -> AWAITING_APPROVAL -> IN_PROGRESS -> FINISHED -> DELIVERED
- Branches:
  - AWAITING_APPROVAL -> CLOSED_WITHOUT_EXECUTION when orçamento is refused
  - IN_PROGRESS -> AWAITING_PARTS when parts are missing
  - AWAITING_PARTS -> IN_PROGRESS when parts are received and reserved
- Transition rules:
  - Create OS in RECEIVED
  - Assume OS only in RECEIVED
  - Diagnose only in UNDER_DIAGNOSIS
  - Generate orçamento in UNDER_DIAGNOSIS or AWAITING_APPROVAL
  - Approve orçamento to move to IN_PROGRESS
  - Refuse orçamento to move to CLOSED_WITHOUT_EXECUTION
  - Finalize execution only in FINISHED path
  - Register delivery only after payment and completion
- Hard constraint: do not update OS freely after it passes AWAITING_APPROVAL; honor the state machine

## Architecture Rules Cheat Sheet

- Dependency flow: presentation -> application -> domain
- Infrastructure implements contracts; it does not define the business rule
- Domain must stay free of NestJS, Prisma, JWT, and other framework imports
- Application orchestrates use cases and depends only on domain abstractions
- Controllers stay thin: validate, map transport, delegate
- Keep event listeners in infrastructure
- Never leak Prisma types outside repositories
- Prefer ports/contracts for cross-module interaction
- Use explicit domain exceptions for invalid transitions
- Do not invent new rules without evidence in requirements, DDD, event storming, tests, or code

## Infrastructure Cheat Sheet

- Database: PostgreSQL
- ORM: Prisma 5
- API runtime: NestJS 10
- Auth: JWT + bcrypt
- Testing: Jest + supertest
- Local development: Docker + Docker Compose
- App container: multi-stage Dockerfile with non-root runtime user
- Compose files:
  - docker-compose.dependencies.yml for PostgreSQL only
  - docker-compose.yml for app + database
- CI/CD: GitHub Actions for tests, build, and ZAP scans
- Missing from repo: Kubernetes, Terraform, ADRs
- Operational note: startup and migration strategy are explicit infrastructure concerns, not domain concerns

## Fast Retrieval Order

1. Check the relevant bounded context.
2. Check the aggregate invariants.
3. Check the lifecycle state transition.
4. Check the domain event that should fire.
5. Check the architecture rule before wiring code across layers.
6. Check infrastructure only for deployment, persistence, auth, and runtime concerns.
