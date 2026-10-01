# Catálogo de Eventos de Integração (Fase 4)

> Consolidação formal do catálogo de eventos de integração exigido pela
> Feature #309 ("Definir Mensageria e Contratos de Eventos"), registrada em
> [ADR-0018](../adr/0018-mensageria-contratos-eventos.md). O envelope
> padrão, a topologia de tópicos e a estratégia de retry/DLQ estão
> descritos na ADR — este documento só lista **quem produz e quem consome
> cada evento**.
>
> **Revisão de 30/09/2026 (`rev/Epic_1`).** Alinhado a
> [`saga-flow.md`](./saga-flow.md), fonte única do fluxo: entra
> `ExecucaoConcluida`; `OrcamentoGeracaoFalhou` e `ExecucaoInicioFalhou`
> deixam de existir, absorvidos por `EtapaDaSagaFalhou` (campo `etapa`);
> nomes passam a ser os do código (`OrdemServicoRecebida`,
> `OrcamentoRecusado`); `OrcamentoAprovado` também é consumido pelo OS
> Service (reserva de peças); `PagamentoConfirmado` vem de webhook assíncrono
> do Mercado Pago.
>
> Complemento da mesma revisão: `correlationId` = `ordemServicoId` em todos
> os eventos; a aprovação pública cria a cobrança (Billing grava
> `Orcamento=APPROVED` + `Pagamento=AGUARDANDO_PAGAMENTO` numa transação e
> publica `OrcamentoAprovado` após o commit); não há chamada REST entre
> serviços; nova tabela "Assinaturas por serviço"; detector de OS parada
> como CronJob do Kubernetes, cobrindo só `aprovacao-pagamento`.
>
> Complemento (modelo híbrido do Execução e Produção): entra o evento
> `DiagnosticoIniciado`; o Execução passa a consumir `OrdemServicoRecebida`
> (fila de diagnóstico), `PagamentoConfirmado` (fila de reparo, sem publicar
> evento), `OrcamentoRecusado` e `PagamentoRecusado` (cancelamento);
> `ExecucaoIniciada` passa a significar "mecânico iniciou o reparo"; o OS
> Service passa a consumir `PagamentoConfirmado` (só grava `pago_em`) e
> `DiagnosticoIniciado`; `etapa` ganha `diagnostico`; rotas de orçamento com
> `{ordemServicoId}`; `EtapaDaSagaFalhou` do detector com
> `eventTypeOriginal = null`.

## Escopo

Este catálogo cobre apenas os **eventos de integração** — os que
atravessam a fronteira entre OS Service, Billing Service e Execução e
Produção, publicados em Kafka. Não cobre os eventos internos que
permanecem in-process dentro do OS Service (Bounded Contexts
`ordem-servico`, `cadastro` e `pecas-insumos`, listados em `docs/ddd.md`
§5.1/§5.2/§5.3), que continuam usando o `EmissorEventos`
([ADR-0009](../adr/0009-eventos-dominio-in-process.md)) sem alteração.

O fluxo completo, incluindo os caminhos de falha e compensação, está
detalhado em [`saga-flow.md`](./saga-flow.md); este documento é a
referência tabular derivada dele.

## Eventos reaproveitados do catálogo de domínio (`docs/ddd.md` §5.1)

Já existiam como eventos de domínio do BC `ordem-servico`; passam a também
ser publicados em Kafka como eventos de integração, com o mesmo nome.

| Evento | Tópico | Produtor | Consumidor(es) | Observação |
|---|---|---|---|---|
| `OrdemServicoRecebida` | `os.eventos.v1` | OS Service | Execução e Produção | Marca o início da saga. O `correlationId` de todos os eventos da OS é o próprio `ordemServicoId`. O Execução e Produção cria a `Execucao` com status `AGUARDANDO_DIAGNOSTICO` (fila de diagnóstico). Se a OS já estiver encerrada ou a `Execucao` já existir, ack e ignora (com log). |
| `OrcamentoGerado` | `billing.eventos.v1` | Billing Service | OS Service | OS Service atualiza status para `AWAITING_APPROVAL`. |
| `OrcamentoAprovado` | `billing.eventos.v1` | Billing Service | OS Service | Disparado pela rota pública de aprovação (`PATCH /api/v1/orcamentos/{ordemServicoId}/aprovar`), atendida pelo Billing Service: valida o orçamento `PENDING`, cria a preference do Checkout Pro (`external_reference=ordemServicoId`), grava numa transação `Orcamento=APPROVED` + `Pagamento=AGUARDANDO_PAGAMENTO`, **publica após o commit** e responde `{ linkPagamento }`. OS Service **reserva as peças** e registra em `HistoricoStatusOS` ("orçamento aprovado, aguardando pagamento"); a OS **permanece** em `AWAITING_APPROVAL` até `ExecucaoIniciada`. Se a OS já estiver `CLOSED_WITHOUT_EXECUTION`, **não reserva** (ack e ignora, com log). |
| `OrcamentoRecusado` | `billing.eventos.v1` | Billing Service | OS Service, Execução e Produção | Recusa de negócio: cliente recusa o orçamento (`EstimateStatus=REJECTED`), pela rota `PATCH /api/v1/orcamentos/{ordemServicoId}/recusar`. OS Service fecha a OS como `CLOSED_WITHOUT_EXECUTION`; Execução e Produção leva a `Execucao` a `CANCELADA` (sai da fila). |

## Eventos novos de integração (formalizados por esta Feature)

Nomes e responsabilidades fechados pela
[ADR-0018](../adr/0018-mensageria-contratos-eventos.md) e pelo fluxo de
[`saga-flow.md`](./saga-flow.md).

| Evento | Tópico | Produtor | Consumidor(es) | Observação |
|---|---|---|---|---|
| `OrcamentoCalculado` | `os.eventos.v1` | OS Service | Billing Service | Carrega `valorTotalServicos`, `valorTotalPecas`, `valorTotalGeral` calculados pelo OS Service. O Billing Service persiste esses valores no documento de orçamento — não os recalcula nem consulta o OS Service por REST; o `OrcamentoCalculado` é a única fonte dos valores, inclusive para o valor da preference do Checkout Pro. Se chegar repetido depois da aprovação, o Billing **ignora** (não lança `DomainException`). |
| `DiagnosticoIniciado` | `execucao.eventos.v1` | Execução e Produção | OS Service | Publicado quando o mecânico chama `PATCH /api/v1/execucoes/{id}/iniciar-diagnostico` (`Execucao` vai a `EM_DIAGNOSTICO`). OS Service leva a OS de `RECEIVED` a `UNDER_DIAGNOSIS`; se a OS já estiver em `UNDER_DIAGNOSIS` ou além, ou encerrada, ack e ignora (com log). |
| `PagamentoConfirmado` | `billing.eventos.v1` | Billing Service | Execução e Produção, OS Service | Publicado quando o webhook do Mercado Pago (assinatura HMAC) chega e a reconsulta `GET /v1/payments/{id}` confirma o pagamento aprovado. O webhook é **assíncrono** e acontece fora do broker. Execução e Produção leva a `Execucao` a `AGUARDANDO_REPARO` (fila de reparo) **sem publicar evento**. OS Service só grava `pago_em` (coluna `nullable`, **sem mudar o status**) e uma linha em `HistoricoStatusOS`; o detector de OS parada só considera OS com `pago_em` nulo. Se a OS já estiver `CLOSED_WITHOUT_EXECUTION`, ack e ignora (com log). |
| `PagamentoRecusado` | `billing.eventos.v1` | Billing Service | OS Service, Execução e Produção | Recusa de negócio: pagamento com status **terminal** no Mercado Pago (`rejected`, `cancelled`). Pagamento `pending`/`in_process` não gera evento. OS Service **libera a reserva de peças** e fecha a OS como `CLOSED_WITHOUT_EXECUTION`; Execução e Produção leva a `Execucao` a `CANCELADA`. Não há estorno (nada foi capturado). |
| `ExecucaoIniciada` | `execucao.eventos.v1` | Execução e Produção | OS Service | Publicado quando o mecânico chama `PATCH /api/v1/execucoes/{id}/iniciar-reparo` (`Execucao` vai de `AGUARDANDO_REPARO` a `EM_REPARO`): significa "mecânico iniciou o reparo". OS Service leva a OS a `IN_PROGRESS` (ou `AWAITING_PARTS`, se a reserva de peças ficou pendente). |
| `ExecucaoConcluida` | `execucao.eventos.v1` | Execução e Produção | OS Service | Publicado quando o mecânico chama `PATCH /api/v1/execucoes/{id}/concluir` (`Execucao` vai a `CONCLUIDA`). OS Service leva a OS a `FINISHED`. |
| `EtapaDaSagaFalhou` | `os.eventos.v1` / `billing.eventos.v1` / `execucao.eventos.v1` (o do serviço cujo consumo falhou ou que detectou a OS parada) | Consumidor da dead-letter topic do serviço que falhou (`<servico>.dlt.v1`) **ou** detector de OS parada (OS Service, CronJob do Kubernetes; na Fase 4 só OS em `AWAITING_APPROVAL`, `etapa=aprovacao-pagamento`) | OS Service, Billing Service, Execução e Produção (cada um reage conforme a `etapa`, ver matriz em `saga-flow.md` §3) | Único evento de falha **técnica** da saga: exceção que esgotou as 3 tentativas de retry (ADR-0018, "Estratégia de retry e dead-letter") ou OS parada além do prazo. Payload mínimo: `servicoOrigem`, `eventTypeOriginal`, `ordemServicoId`, `etapa`, `motivo`. `etapa` ∈ {`diagnostico`, `orcamento`, `aprovacao-pagamento`, `inicio-execucao`, `reparo`}; a `etapa` da DLT sai do `eventType` da mensagem que falhou (tabela "evento original → etapa" em `saga-flow.md` §3). Quando publicado pelo **detector**, `eventTypeOriginal = null` (não há mensagem original) e `servicoOrigem = "os-service"`. Diferente de `OrcamentoRecusado` e `PagamentoRecusado`, que são resultados de negócio válidos e não passam pelo ciclo de retry. |

## Assinaturas por serviço

Derivada das colunas "Consumidor(es)" acima e da matriz de
[`saga-flow.md`](./saga-flow.md) §3. Cada grupo assina os tópicos dos
**outros** serviços, nunca o próprio; além disso, cada serviço consome o
próprio `<servico>.retry.v1` e o próprio `<servico>.dlt.v1`
([ADR-0018](../adr/0018-mensageria-contratos-eventos.md)).

| Consumer group | Tópico assinado | Eventos tratados |
|---|---|---|
| `os-consumer` | `billing.eventos.v1` | `OrcamentoGerado`, `OrcamentoAprovado`, `OrcamentoRecusado`, `PagamentoConfirmado`, `PagamentoRecusado`, `EtapaDaSagaFalhou` |
| `os-consumer` | `execucao.eventos.v1` | `DiagnosticoIniciado`, `ExecucaoIniciada`, `ExecucaoConcluida`, `EtapaDaSagaFalhou` |
| `billing-consumer` | `os.eventos.v1` | `OrcamentoCalculado`, `EtapaDaSagaFalhou` |
| `billing-consumer` | `execucao.eventos.v1` | `EtapaDaSagaFalhou` |
| `execucao-consumer` | `billing.eventos.v1` | `OrcamentoRecusado`, `PagamentoConfirmado`, `PagamentoRecusado`, `EtapaDaSagaFalhou` |
| `execucao-consumer` | `os.eventos.v1` | `OrdemServicoRecebida`, `EtapaDaSagaFalhou` |

Todo evento do catálogo tem ao menos um consumidor. Como ninguém assina o próprio tópico, o serviço que publica
`EtapaDaSagaFalhou` aplica a própria compensação local no mesmo ato (ex.: o
OS Service fechando a OS quando o detector dispara).

## Eventos fora do escopo deste catálogo

- **Entrega da OS** (`PATCH /ordens-servico/:id/registrar-entrega`): ato
  presencial, fora do escopo da saga (`saga-flow.md` §4). Não gera evento
  de integração consumido por outro serviço.
- **Eventos internos** dos BCs `cadastro` e `pecas-insumos` (ex.:
  `ClienteCadastrado`, `PecaCadastrada`, `EstoqueAtualizado`): permanecem
  in-process dentro do OS Service, sem publicação no Kafka.
- **Eventos do BC `financeiro`** anteriores à Fase 4 (`PagamentoRegistrado`,
  `NotaFiscalEmitida`): não fazem parte do fluxo de saga coberto por esta
  Feature; ficam para o épico do Billing Service (#322) avaliar se algum
  deles precisa de equivalente de integração.

## Referências

- [ADR-0018 — Kafka como broker de eventos e contrato padrão de evento](../adr/0018-mensageria-contratos-eventos.md) — envelope, topologia, retry/DLQ
- [`saga-flow.md`](./saga-flow.md) — fluxo completo, incluindo a matriz `etapa → falha → compensação`
- [ADR-0016 — Saga coreografada](../adr/0016-saga-coreografada.md)
- [ADR-0017 — Divisão em três microsserviços e ownership de dados](../adr/0017-divisao-microsservicos-ownership-dados.md)
- [`docs/ddd.md`](../ddd.md) §5 — catálogo de eventos de domínio existentes
- Issue #309 — Definir Mensageria e Contratos de Eventos
- Issue #314 — Provisionar a Plataforma de Mensageria (Kafka) — topologia aplicada, tópicos, consumer groups
