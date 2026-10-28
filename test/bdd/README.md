# Testes BDD do fluxo da Saga

Suíte em Gherkin para o fluxo da Ordem de Serviço entre OS Service, Billing Service e Execução e Produção (Feature [#340](https://github.com/Async-And-Furious/async-furious-project/issues/340)). Decisão de ferramenta, localização e ambiente: [ADR-0023](../../docs/adr/0023-ferramenta-bdd-suite-saga.md). O desenho do fluxo é a fonte dos cenários: [`saga-flow.md`](../../docs/architecture/saga-flow.md) e [`event-catalog.md`](../../docs/architecture/event-catalog.md).

## Estado atual

| Parte | Situação |
|---|---|
| `features/fluxo-saga-os.feature` (caminho feliz e pagamento recusado) | Feito. Texto de especificação, ainda não executável. |
| ADR-0023 (ferramenta e localização) | Proposta, aguarda aceite do grupo. |
| `jest-cucumber` no `package.json` e no lockfile | Não instalado. Entra com a branch da #333, que altera esses arquivos. |
| `steps/*.steps.ts` (step definitions) | Não existe. |
| `test/jest-bdd.json` (configuração de execução) | Não existe. |
| `docker-compose.bdd.yml` (OS, Billing, Execução, Kafka, PostgreSQL, mongo, stub do Mercado Pago) | Não existe. |
| Job de BDD no CI do OS Service | Não existe. Nenhum workflow foi alterado nesta entrega. |

## Dependências

- **#338 (compensações e rollback).** O cenário "Pagamento recusado compensa a saga até CLOSED_WITHOUT_EXECUTION" está marcado com `@depende-338`. Ele só passa quando as compensações estiverem implementadas nos três serviços. O cenário do caminho feliz não depende da #338 e pode ser implementado antes.
- **Billing e Execução e Produção.** O compose precisa das imagens dos dois serviços (decisão em aberto, ADR-0023, item 1). O Billing precisa aceitar a URL base do Mercado Pago por variável de ambiente para que o stub intercepte as chamadas (ADR-0023, item 2, ainda não verificado no repositório do Billing).

## Cobertura

A suíte não entra no número de cobertura unitária. A configuração unitária (`jest.config.js`) executa `*.spec.ts`, e os arquivos desta pasta são `*.feature` e `*.steps.ts`, que ela não executa. A medição de cobertura só olha `src/`. Os 80% da [ADR-0014](../../docs/adr/0014-cobertura-minima-testes.md) medem a suíte unitária, e a suíte BDD não os altera. Quando o job de BDD existir, o README do serviço deve dizer que são métricas distintas.

## O que falta, em ordem

1. Instalar `jest-cucumber@^4.5.0` (depois da #333). O parse de `# language: pt` já foi verificado com a 4.5.0 (ADR-0023, seção 1); repetir o parse ao trocar a versão.
2. Escrever `steps/` para o caminho feliz.
3. Escrever `docker-compose.bdd.yml`: broker Kafka em KRaft com healthcheck, serviço one-shot de criação dos tópicos (`os.eventos.v1`, `billing.eventos.v1`, `execucao.eventos.v1`, `os.retry.v1`, `os.dlt.v1`, `billing.retry.v1`, `billing.dlt.v1`, `execucao.retry.v1`, `execucao.dlt.v1`, 3 partições cada; o prefixo `<servico>` segue o de `*.eventos.v1`, a confirmar com a #314), PostgreSQL com os bancos `os_service`, `billing` e `execucao_producao`, `mongo`, stub do Mercado Pago.
4. Escrever `test/jest-bdd.json` com `testRegex` para `\.steps\.ts$`.
5. Criar o job de BDD no CI do OS Service, com healthcheck, e validar três execuções consecutivas verdes (critério da ADR-0023, seção 4).
6. Escrever `steps/` do cenário de compensação, depois que a #338 estiver mesclada, e remover `@depende-338`.
7. Verificar de propósito, ao menos uma vez, que o job quebra quando o fluxo quebra (critério da #340).

## Regras da suíte

- Sem `sleep` fixo. Esperas de estado por evento são consultas em laço com prazo explícito.
- Sem `jest.retryTimes` nem reexecução de job para esconder falha intermitente.
- O webhook do Mercado Pago é sempre enviado com assinatura HMAC válida.
- Os serviços são chamados diretamente pelas portas do compose. A suíte não testa Gateway nem Authorizer.
- O compose não publica portas que colidam com o ambiente local de desenvolvimento (PostgreSQL em `5433`).
- Nenhum teste depende de HML, de cluster ou de credenciais AWS.
- Estado lido por HTTP quando há rota: OS em `GET /api/v1/ordens-servico/{id}/status`; `Pagamento` em `GET /api/v1/pagamentos/{ordemServicoId}`; `Execucao` pela listagem `GET /api/v1/execucoes?status=...`, achando a `Execucao` pelo `ordemServicoId` (o `{id}` dos PATCH vem daí). Eventos são observados em consumidor de teste nos tópicos.

## Ainda não decidido

Como os passos leem o `Orcamento`, a reserva de peças, `pago_em` e o `HistoricoStatusOS.motivo`: não há rota documentada para eles (ADR-0023, item 3). Os documentos não fixam essa leitura. O `.feature` usa só o que os documentos fixam.
