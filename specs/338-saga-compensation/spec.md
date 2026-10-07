# Issue #338 — Saga: compensação e idempotência

## Objetivo

Implementar, no monólito existente, as regras locais da Saga coreografada descritas em `docs/architecture/saga-flow.md` §3. O código não cria nem presume o serviço Execução; sua integração fica representada por eventos e portas explícitas.

## Escopo

- liberar reservas de estoque de forma idempotente, restaurando estoque apenas uma vez, com delete condicional dentro da transação;
- compensar OS e financeiro conforme a matriz existente;
- ignorar reentregas já aplicadas por recibo persistente com lease recuperável;
- representar pagamentos `CANCELADO` e `ESTORNADO`;
- chamar refund por uma porta explícita, persistindo a chave/operação antes da chamada para permitir retry seguro após crash;
- publicar `EtapaDaSagaFalhou` quando uma etapa técnica falhar e `SagaCompleted` após todas as compensações locais; a conclusão é única por OS;
- cobrir regras com testes unitários e contratos de eventos.

## Matriz aplicada

| Etapa | OS/estoque | Financeiro |
|---|---|---|
| `diagnostico`, `orcamento`, `aprovacao-pagamento` | fecha OS; libera reserva quando existente | cancela pagamento não capturado |
| `inicio-execucao` | fecha OS e libera reserva | estorna pagamento confirmado |
| `reparo` | não compensa automaticamente; registra evidência persistente do resultado | não estorna automaticamente |

Recusas de orçamento/pagamento fecham a OS; `PagamentoRecusado` também libera a reserva. A compensação é deduplicada por `eventId`/estado terminal. Refund com falha propaga erro retentável e não marca o pagamento como estornado.

## Contratos

- `IRefundGateway`: adapter externo opcional, `refund(paymentId, amount)`.
- `ISagaCompensationPort`: porta do agregado OS para fechar a OS e registrar motivo.
- `SagaCompleted` e `EtapaDaSagaFalhou`: eventos de integração locais, correlacionados por `ordemServicoId`.

## Runtime

`SagaCompensationModule` registra o consumidor Nest dos eventos `EtapaDaSagaFalhou` e `OrcamentoRecusado`, ligando-o aos repositórios Prisma e ao provider de refund. Não há serviço Execução neste repositório.

## Fora do escopo

Não há serviço Execução, chamada REST, migration destrutiva, apply ou chamada externa. O consumidor/adaptador do serviço Execução deverá assinar os mesmos contratos em seu próprio repositório.

## Validação

`pnpm run type:check`, `pnpm run test` e `pnpm run build`.
