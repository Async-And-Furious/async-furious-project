# Project Context - Quick View

## Essência do Projeto

Async Furious é um backend monolítico em NestJS para gestão de oficina mecânica. O sistema centraliza clientes, veículos, ordens de serviço, orçamento, peças, pagamentos e entrega final do veículo.

## Fontes de Verdade

1. Requisitos Fase 2
2. Requisitos Fase 1
3. DDD
4. Event Storming
5. Código-fonte

## Stack

- TypeScript
- NestJS 10
- PostgreSQL
- Prisma 5
- Jest + supertest
- Docker + Docker Compose
- GitHub Actions

Não há Kubernetes, Terraform ou ADRs no repositório atual.

## Contextos Delimitados

- Cadastro: clientes, veículos e serviços
- Ordem de Serviço: ciclo de vida da OS, orçamento e status
- Peças e Insumos: estoque, reservas e fornecedor
- Financeiro: pagamento e gatilho de entrega
- Auth: login, JWT e roles
- Health: health check

## Entidades e Agregados Principais

- Cliente
- Veiculo
- Servico
- OrdemDeServico
- Orcamento
- OsPeca
- PecaInsumo
- PedidoFornecedor
- ReservaEstoque
- Pagamento

## Regras Críticas

- Cliente e veículo exigem validações de documento, e-mail e placa.
- A OS nasce em RECEIVED.
- Assumir OS só é permitido em RECEIVED.
- Diagnóstico só ocorre em UNDER_DIAGNOSIS.
- Orçamento leva a AWAITING_APPROVAL.
- Aprovação leva a IN_PROGRESS.
- Se faltar peça, a OS vai para AWAITING_PARTS.
- Finalização leva a FINISHED.
- Pagamento leva a DELIVERED.
- Recusa encerra a OS sem execução.

## Ciclo de Vida da OS

RECEIVED → UNDER_DIAGNOSIS → AWAITING_APPROVAL → IN_PROGRESS → FINISHED → DELIVERED

Ramificações:

- AWAITING_APPROVAL → CLOSED_WITHOUT_EXECUTION
- AWAITING_APPROVAL → AWAITING_PARTS → IN_PROGRESS

## Infraestrutura

- Dockerfile multi-stage com usuário não-root
- docker-compose.dependencies.yml para PostgreSQL
- docker-compose.yml para app + banco
- GitHub Actions para testes, build e ZAP

## Documentos Mais Importantes

- [docs/ai/architecture-handbook.md](architecture-handbook.md)
- [docs/Fase 1 - Tech Challenge.pdf](../Fase%201%20-%20Tech%20Challenge.pdf)
- [docs/Fase 2 - Tech Challenge.pdf](../Fase%202%20-%20Tech%20Challenge.pdf)
- [docs/ddd.md](../ddd.md)
- [docs/http/insomnia.yaml](../http/insomnia.yaml)
- [README.md](../../README.md)

## Regra Para Agentes

Antes de implementar qualquer mudança:

1. Ler o requisito.
2. Consultar o DDD.
3. Identificar o bounded context.
4. Confirmar aggregate e eventos.
5. Validar se a regra já existe no código.

Não criar regra nova sem evidência documental.