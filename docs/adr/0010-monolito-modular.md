# ADR-0010: Monólito modular como topologia de implantação

## Status

Aceita

## Contexto

O enunciado da Fase 1 exigia explicitamente "back-end monolítico". A
equipe precisava, dentro dessa restrição, de uma forma de manter os
Bounded Contexts de negócio isolados no código para não degenerar num
monólito "big ball of mud".

## Decisão

Organizar o monólito em **módulos por Bounded Context** dentro de
`src/modules/`: `cadastro` (Cliente, Veículo, Serviço), `ordem-servico`
(OrdemServico, Orçamento), `pecas-insumos` (Peça/estoque), `financeiro`
(Pagamento) — mais um módulo transversal `auth`. Cada módulo replica
internamente a mesma separação em camadas de
[ADR-0006](./0006-clean-architecture-ddd.md).

## Alternativas consideradas

Nenhuma alternativa é aplicável — "back-end monolítico" era exigência
obrigatória do enunciado da Fase 1, não uma escolha da equipe. A decisão
real da equipe foi *como* organizar esse monólito internamente (módulos
por contexto), não *se* seria monólito.

## Consequências positivas

- Bounded Contexts ficam isolados por pasta/módulo, com fronteiras claras,
  mesmo sem separação física de processo.
- Deploy único, simples, sem necessidade de orquestrar múltiplos serviços
  nas Fases 1/2.
- Testes e cobertura ([ADR-0014](./0014-cobertura-minima-testes.md)) rodam
  contra um único processo, sem necessidade de ambiente de integração
  multi-serviço.

## Consequências negativas

- Nomes de módulos de código (`cadastro`, `ordem-servico`, `pecas-insumos`,
  `financeiro`) não coincidem literalmente com os nomes dos Bounded
  Contexts conceituais em `docs/ddd.md` ("Clientes e Veículos", "Estoque e
  Serviços") — o próprio `ddd.md` reconhece essa tensão: um BC conceitual
  ("Estoque e Serviços") está fisicamente dividido em dois módulos de
  código (`pecas-insumos` + catálogo de `Servico` dentro de `cadastro`).
- Esta é a topologia que a Fase 3 começa a reverter parcialmente — a
  separação em quatro repositórios ([ADR-0001](./0001-separacao-quatro-repositorios.md))
  extrai autenticação e infraestrutura para fora do monólito, mas os quatro
  módulos de negócio permanecem juntos aqui.

## Riscos

- **Baixo**: nenhum risco novo — é o ponto de partida da arquitetura, já
  registrado como consequência histórica, não como decisão em aberto.

## Referências

- `AGENTS.md` (seção "Architecture", tabela "Modules (4 domain modules)")
- `README.md` (seção "Estrutura do Projeto")
- [`docs/ddd.md`](../ddd.md) §3 (nota de nomenclatura)
- `docs/contexto-tecnico-consolidado.md` §2
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #7)
