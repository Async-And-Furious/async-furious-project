# ADR-0014: Cobertura mínima de testes automatizados

## Status

Aceita

## Contexto

O enunciado da Fase 1 exigia cobertura mínima de 80% em domínios críticos.
A documentação do projeto diverge sobre qual é o threshold efetivamente em
vigor:

- `README.md` (seção "Thresholds de Cobertura") afirma: Statements 85%,
  Lines 85%, Functions 80%, Branches 80%.
- `jest.config.js:33-39` (`coverageThreshold.global`) configura, na
  prática: **branches 80, functions 80, lines 80, statements 80** — 80%
  uniforme em todas as métricas, não 85% em statements/lines.

Como o `jest.config.js` é o que o Jest de fato executa e falha o build se
violado, ele é a fonte de verdade sobre o que está *em vigor* — o
`README.md` está desatualizado neste ponto específico (não foi corrigido
por esta tarefa, que é sobre ADRs, não sobre o README).

## Decisão

Cobertura mínima de **80%** em todas as quatro métricas do Jest
(`branches`, `functions`, `lines`, `statements`), enforçada globalmente via
`coverageThreshold.global` em `jest.config.js`. Build falha se qualquer
métrica cair abaixo de 80%.

## Alternativas consideradas

- **85% em statements/lines** (o que o `README.md` afirma): não é o que
  está de fato configurado — não há evidência de que isso tenha sido
  aplicado e depois revertido, mais provável que o README nunca tenha
  refletido o `jest.config.js` real, ou que uma mudança em um dos dois não
  tenha sido replicada no outro.
- **Cobertura por módulo/pasta** (thresholds diferentes por criticidade):
  não adotada — o threshold é único e global.

## Consequências positivas

- Threshold único e simples de entender/manter — um só número para todo o
  código.
- Enforçado automaticamente pelo Jest, sem depender de revisão manual para
  notar queda de cobertura.

## Consequências negativas

- Divergência entre `README.md` e `jest.config.js` pode levar alguém a
  acreditar que o padrão é 85%/85%/80%/80% quando na prática é 80%
  uniforme — risco de mal-entendido em code review ou ao configurar CI
  externo.
- Threshold único não diferencia código de domínio crítico (ex.: cálculo de
  orçamento) de código de infraestrutura/boilerplate — 80% em ambos tem
  peso de risco muito diferente.

## Riscos

- **Baixo, mas real**: `README.md` precisa ser corrigido para bater com
  `jest.config.js` (80/80/80/80, não 85/85/80/80) — fora do escopo desta
  tarefa de ADRs, mas registrado aqui como pendência a ser corrigida
  separadamente para não perpetuar a divergência.

## Referências

- `jest.config.js:33-39`
- `README.md` (seção "Thresholds de Cobertura")
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #13)
