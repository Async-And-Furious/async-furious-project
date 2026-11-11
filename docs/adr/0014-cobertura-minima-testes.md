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
`README.md` está desatualizado neste ponto específico (não o corrigimos
nesta tarefa, que trata de ADRs, não do README).

## Decisão

Cobertura mínima de **80%** em todas as quatro métricas do Jest
(`branches`, `functions`, `lines`, `statements`), enforçada globalmente via
`coverageThreshold.global` em `jest.config.js`. Build falha se qualquer
métrica cair abaixo de 80%.

## Alternativas consideradas

- **85% em statements/lines** (o que o `README.md` afirma): não é o que
  está de fato configurado — não há evidência de que isso tenha sido
  aplicado e depois revertido; é mais provável que o README nunca tenha
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

## Evidência

- O job `Run All Tests` (`.github/workflows/tests.yml`) roda `pnpm run test:cov`
  e publica o artifact `coverage` em cada execução (retenção de 7 dias),
  com `lcov.info`, `clover.xml` e o relatório HTML `lcov-report/`.
- O job `sonar` analisa o mesmo relatório no SonarCloud.
- `README.md` e `README-en.md` apontam para essa evidência.

## Riscos

- **Baixo, mas real**: `README.md` precisa ser corrigido para bater com
  `jest.config.js` (80/80/80/80, não 85/85/80/80) — fora do escopo desta
  tarefa de ADRs, mas registrado aqui como pendência a ser corrigida
  separadamente para não perpetuar a divergência. A correção é da Feature
  #333 (ver Atualização abaixo).

## Atualização (Fase 4: cobertura por serviço)

**Revisão de 27/10/2026, Feature #316.** A decisão de 80% uniforme nas
quatro métricas **continua valendo**. Mudam três coisas:

- **O threshold passa a valer por serviço.** O enunciado da Fase 4 exige
  "cobertura mínima de 80% por serviço" (p.4). Cada repositório de serviço
  nasce com o mesmo `coverageThreshold.global` em 80 no seu próprio
  `jest.config.js`, e é esse threshold o gate primário do pipeline do
  serviço (falha em segundos, sem depender de serviço externo). O Quality
  Gate do SonarQube Cloud entra como segundo olhar sobre o mesmo relatório
  `lcov`. A cobertura de um serviço não compensa a de outro: não existe
  número agregado entre repositórios.
- **O gate precisa rodar no CI de fato.** Hoje o `tests.yml` executa
  `pnpm test` (`jest` sem `--coverage`), e sem coleta de cobertura o Jest
  não avalia o `coverageThreshold`: o gate só falha para quem roda
  `pnpm test:cov` localmente. A troca para `pnpm test:cov` é da Feature
  #333, e é essa versão do `tests.yml` que os serviços copiam. Medição de
  27/10/2026 na `develop` (`acacd5e`): `pnpm test:cov` passa nos testes
  (810/810), mas falha no gate de branches com **79,27%** (statements
  94,97%, functions 90,28%, lines 94,96%). Quando a #333 ligar o
  `test:cov` no CI, o pipeline fica vermelho até a cobertura de branches
  chegar a 80%.
- **A divergência do README é corrigida antes da cópia.** O `README.md`
  (linha de funcionalidades: 85%) e o `README-en.md` (tabela 85/85/80/80)
  ainda divergem do `jest.config.js`. A correção para 80 uniforme é da
  Feature #333 e precisa entrar **antes** de o `README.md` virar template,
  para a divergência não ser replicada justamente no arquivo que o
  enunciado da Fase 4 (p.5) pede como evidência de cobertura.

Continua valendo a consequência negativa do threshold único: dentro de
cada serviço, código de domínio crítico e boilerplate pesam igual.

## Referências

- `jest.config.js:33-39`
- `README.md` (seção "Thresholds de Cobertura")
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #13)
