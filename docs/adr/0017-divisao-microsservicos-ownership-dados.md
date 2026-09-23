# ADR-0017: Divisão em três microsserviços e ownership de dados por serviço

## Status

Aceita

> Numeração escolhida como 0017, não 0016: no momento da escrita desta ADR
> existe trabalho em andamento (não commitado) em outra branch do grupo
> (`feat/I-308_DefinirEstrategiaDeSaga`) já usando `0016-saga-coreografada.md`
> para a Feature #308. Como as duas branches partem do mesmo ponto de
> `develop` (onde a última ADR commitada é a 0015), usar 0017 aqui evita a
> colisão de nome de arquivo no merge — mas o índice de
> [`docs/adr/README.md`](./README.md) ainda vai precisar de conferência
> manual quando as duas branches integrarem, para garantir que a numeração
> final fique sequencial e sem lacuna.

## Contexto

A Fase 1 exigia "back-end monolítico" e o grupo organizou esse monólito em
módulos por Bounded Context (`docs/adr/0010-monolito-modular.md`):
`cadastro`, `ordem-servico`, `pecas-insumos`, `financeiro`, mais o módulo
transversal `auth`. O enunciado da Fase 4 exige o oposto: "Refatore a
aplicação em, no mínimo, 3 microsserviços independentes, cada um com seu
próprio repositório, infraestrutura e banco de dados" (p.2), com o requisito
adicional de que "nenhum serviço pode acessar diretamente o banco de outro
serviço" (p.4).

## Decisão

Dividir o monólito em três serviços, decisão fechada pelo grupo em
21/09/2026 (`fase4-decisoes-epico1.md`, F1) e detalhada em
[`docs/architecture/service-boundaries.md`](../architecture/service-boundaries.md):

1. **OS Service** — reaproveita este repositório (`async-furious-project`),
   herdando `ordem-servico`, `cadastro` e `pecas-insumos`. Não é repositório
   novo.
2. **Billing Service** — repositório novo (issue #323), extraído do módulo
   `financeiro`, somado ao model `Orcamento` (que migra de `ordem-servico`).
3. **Execução e Produção** — repositório novo (issue #319), serviço sem
   nenhum model herdado do monólito.

Cada serviço ganha banco de dados próprio (uma instância RDS compartilhada,
mas com banco lógico e credencial isolados por serviço, mais o DynamoDB do
OS Service — decisão de infraestrutura tratada no Epic #312, fora desta ADR).
Toda FK que cruzar a fronteira de serviço vira referência por id, sem
integridade referencial no banco — o padrão que `Pagamento.ordemServicoId`
já usava antes mesmo desta divisão existir.

O mapa completo de ownership (todos os models do `prisma/schema.prisma`) e a
lista de FKs afetadas estão em `service-boundaries.md` — não duplicados
aqui para não haver duas fontes de verdade divergentes.

## Alternativas consideradas

- **Dividir por camada técnica** (ex.: um serviço de "leitura", um de
  "escrita"): descartado — não é o que o enunciado pede (divisão é por
  contexto de negócio, p.3) e não reduz acoplamento entre times/domínios.
- **Mais de 3 serviços** (ex.: separar `cadastro` do OS Service): avaliado e
  descartado pelo grupo — o enunciado pede "no mínimo 3", não recompensa
  granularidade extra, e cada serviço a mais é mais um repositório, banco,
  namespace, pipeline e consumidor Kafka para manter funcionando em 8
  semanas de Fase 4.
- **Menos de 3 serviços**: não é opção — viola o requisito mínimo explícito
  do enunciado (p.2).

## Consequências positivas

- Cumpre o requisito mínimo do enunciado com folga de tempo, em vez de
  granularidade que não seria avaliada.
- Reaproveita 100% o código e os testes já existentes do OS Service — não
  há reescrita, só extração do que já está em módulo isolado
  (`docs/adr/0010`).
- FKs cross-fronteira já seguiam o padrão de referência por id em
  `Pagamento` antes desta ADR existir — não é um padrão novo a validar, é
  extensão de um que já roda em produção.

## Consequências negativas

- `Orcamento` perde a garantia de integridade referencial (`onDelete:
  Cascade`) que tinha dentro do mesmo banco — deletar uma `OrdemServico` no
  OS Service não cascateia mais para o `Orcamento` no Billing Service. A
  Feature #307 registrou essa consequência como aceita, sem propor
  mecanismo de compensação (fica para as Features de Mensageria/#309 e de
  extração do Financeiro/#330).
- A regra de pagamento → entrega, antes uma checagem local ao mesmo banco,
  passa a depender de informação vinda de outro serviço (ver
  `docs/architecture/service-order-flow.md`). A relação dessa regra com a
  sequência de Saga foi resolvida pela [ADR-0016](./0016-saga-coreografada.md):
  há um único pagamento, cobrado na etapa da Saga logo após a aprovação, e a
  checagem em `registrar-entrega` é apenas trava de segurança sobre ele.

## Riscos

- **Baixo**: colisão de numeração de ADR com a branch paralela de #308 (ver
  nota em "Status") — resolução mecânica no momento do merge, sem impacto de
  conteúdo.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.2, p.3 e p.4
- `fase4-decisoes-epico1.md`, seção F1 (fora do repositório, workspace local do grupo)
- Issue [#307](https://github.com/Async-And-Furious/async-furious-project/issues/307) — Definir Divisão de Microsserviços e Ownership de Dados
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- [`docs/architecture/service-boundaries.md`](../architecture/service-boundaries.md) (mapa de ownership completo)
- [`docs/architecture/service-order-flow.md`](../architecture/service-order-flow.md) (regra pagamento → entrega)
- [`docs/adr/0010-monolito-modular.md`](./0010-monolito-modular.md) (substituída por esta ADR)
- [`docs/adr/0011-aprovacao-orcamento-api-publica.md`](./0011-aprovacao-orcamento-api-publica.md) (revisada com a migração do `Orcamento`)
