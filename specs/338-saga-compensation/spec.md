# Issue #338 — Saga: compensação e idempotência

## Objetivo

Implementar, no monólito existente, as regras locais da Saga coreografada descritas em `docs/architecture/saga-flow.md` §3. O código não cria nem presume o serviço Execução; sua integração fica representada por eventos e portas explícitas.

## Escopo

- liberar reservas de estoque de forma idempotente, restaurando estoque apenas uma vez;
- compensar OS e financeiro conforme a matriz existente;
- ignorar reentregas já aplicadas;
- representar pagamentos `CANCELADO` e `ESTORNADO`;
- chamar refund por uma porta explícita, sem integração Mercado Pago neste repositório;
- publicar `EtapaDaSagaFalhou` quando uma etapa técnica falhar e `SagaCompleted` após todas as compensações locais;
- cobrir regras com testes unitários e contratos de eventos.

## Matriz aplicada

| Etapa | OS/estoque | Financeiro |
|---|---|---|
| `diagnostico`, `orcamento`, `aprovacao-pagamento` | fecha OS; libera reserva quando existente | cancela pagamento não capturado |
| `inicio-execucao` | fecha OS e libera reserva | estorna pagamento confirmado |
| `reparo` | não compensa automaticamente | não estorna automaticamente |

Recusas de orçamento/pagamento fecham a OS; `PagamentoRecusado` também libera a reserva. A compensação é deduplicada por `eventId`/estado terminal. Refund com falha propaga erro retentável e não marca o pagamento como estornado.

## Contratos

- `IRefundGateway`: adapter externo opcional, `refund(paymentId, amount)`.
- `ISagaCompensationPort`: porta do agregado OS para fechar a OS e registrar motivo.
- `SagaCompleted` e `EtapaDaSagaFalhou`: eventos de integração locais, correlacionados por `ordemServicoId`.

## Fora do escopo

Não há serviço Execução, chamada REST, migration destrutiva, apply ou chamada externa. O consumidor/adaptador do serviço Execução deverá assinar os mesmos contratos em seu próprio repositório.

## Validação

`pnpm run type:check`, `pnpm run test` e `pnpm run build`.
