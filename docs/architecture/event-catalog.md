# Catálogo de Eventos de Integração (Fase 4)

> Consolidação formal do catálogo de eventos de integração exigido pela
> Feature #309 ("Definir Mensageria e Contratos de Eventos"), registrada em
> [ADR-0018](../adr/0018-mensageria-contratos-eventos.md). O envelope
> padrão, a topologia de tópicos e a estratégia de retry/DLQ estão
> descritos na ADR — este documento só lista **quem produz e quem consome
> cada evento**.

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
| `OrdemDeServicoRecebida` | `os.eventos.v1` | OS Service | Nenhum consumidor formal hoje | Marca o início da saga e o nascimento do `correlationId`. Publicado para rastreamento/trace e possível extensão futura (ex.: dashboard do épico de Observabilidade), não para acionar outro serviço. |
| `OrcamentoGerado` | `billing.eventos.v1` | Billing Service | OS Service | OS Service atualiza status para `AWAITING_APPROVAL`. |
| `OrcamentoAprovado` | `billing.eventos.v1` | Billing Service | OS Service | Disparado pela rota pública `PATCH /ordens-servico/:id/orcamento/aprovar`, atendida pelo Billing Service. OS Service registra em `HistoricoStatusOS`. |
| `OrcamentoRejeitado` | `billing.eventos.v1` | Billing Service | OS Service | Caminho de falha: cliente recusa o orçamento. OS Service fecha a OS como `CLOSED_WITHOUT_EXECUTION`. |

## Eventos novos de integração (formalizados por esta Feature)

Antecipados em `saga-flow.md` como `[novo]` ou como "a formalizar com a
#309" — nomes e responsabilidades fechados pela [ADR-0018](../adr/0018-mensageria-contratos-eventos.md).

| Evento | Tópico | Produtor | Consumidor(es) | Observação |
|---|---|---|---|---|
| `OrcamentoCalculado` | `os.eventos.v1` | OS Service | Billing Service | Carrega `valorTotalServicos`, `valorTotalPecas`, `valorTotalGeral` calculados pelo OS Service. O Billing Service persiste esses valores no documento de orçamento — não os recalcula. |
| `PagamentoConfirmado` | `billing.eventos.v1` | Billing Service | Execução e Produção | Publicado após confirmação da cobrança no Mercado Pago (integração síncrona, fora do broker). Dispara o início da execução. |
| `PagamentoRecusado` | `billing.eventos.v1` | Billing Service | OS Service | Caminho de falha: pagamento recusado ou não confirmado. OS Service fecha a OS como `CLOSED_WITHOUT_EXECUTION`. Não há estorno (pagamento nunca foi capturado). |
| `ExecucaoIniciada` | `execucao.eventos.v1` | Execução e Produção | OS Service | OS Service atualiza status para `IN_PROGRESS`. |
| `OrcamentoGeracaoFalhou` | `billing.eventos.v1` | Billing Service | OS Service | **Falha de negócio/técnica** (não passa pelo ciclo de retry/DLT): Billing Service não conseguiu persistir o `Orcamento` a partir do `OrcamentoCalculado` recebido. OS Service fecha a OS como `CLOSED_WITHOUT_EXECUTION`. |
| `ExecucaoInicioFalhou` | `execucao.eventos.v1` | Execução e Produção | Billing Service, OS Service | **Falha de negócio** (ex.: peça indisponível, capacidade esgotada), identificada só nesta etapa, **após** o pagamento já ter sido capturado. Billing Service consome para acionar o **estorno real** no Mercado Pago; OS Service consome para fechar a OS como `CLOSED_WITHOUT_EXECUTION`. |
| `EtapaDaSagaFalhou` | `os.eventos.v1` / `billing.eventos.v1` / `execucao.eventos.v1` (o do serviço cujo consumo falhou) | Consumidor da dead-letter topic do serviço que falhou (`<servico>.dlt.v1`) | Demais serviços interessados na etapa correspondente | Evento genérico de falha **técnica** de processamento (exceção, indisponibilidade), publicado depois de esgotadas as 3 tentativas de retry (ver ADR-0018, "Estratégia de retry e dead-letter"). Diferente dos dois eventos de falha de negócio acima, que não são erro de processamento. Payload mínimo: `servicoOrigem`, `eventTypeOriginal`, `ordemServicoId`, `motivo`. |

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
