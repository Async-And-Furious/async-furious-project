# Sequência de Abertura e Acompanhamento da Ordem de Serviço

> Este fluxo **já existia** documentado em três artefatos independentes e
> consistentes entre si: o Domain Storytelling
> ([`domain-storytelling.suggestion.vic.png`](../domain-storytelling/suggestions/domain-storytelling.suggestion.vic.png)),
> a sequência UML
> ([`os-flow.suggestion.vic.mmd`](../others/suggestions/os-flow.suggestion.vic.mmd))
> e o relatório E2E real
> ([`relatorio-e2e-orcamento-curl.md`](../reports/relatorio-e2e-orcamento-curl.md)).
> Este documento **formaliza** essa sequência já existente, anotando-a com
> endpoints reais, papéis exigidos, estados (`SOStatus`) e eventos de domínio
> documentados em [`ddd.md`](../ddd.md) §5.1. Entre a Fase 3 e a Fase 4 o
> fluxo muda em um ponto: as ações do mecânico `assumir`, `analisar` e
> `finalizar-execucao` saíram do OS Service para o Execução e Produção
> (Feature #334) e chegam aqui por evento — o diagrama abaixo já reflete isso;
> o detalhe está em
> [`os-service-integracao-execucao.md`](./os-service-integracao-execucao.md).
> O mecanismo de autenticação/autorização de borda segue em
> [authentication-flow.md](./authentication-flow.md).

```mermaid
sequenceDiagram
    actor Cliente
    actor Recepcionista
    actor Mecanico
    participant API as Aplicação (ordem-servico BC)
    participant Exec as Execução e Produção
    participant DB as PostgreSQL
    participant Obs as Observabilidade [PENDENTE]

    Cliente->>Recepcionista: Informa dados e necessidade de serviço (fora do sistema)
    Recepcionista->>API: POST /clientes, POST /veiculos (papel RECEPCIONISTA)
    API->>DB: persiste Cliente/Veículo
    Recepcionista->>API: POST /ordens-servico (papel RECEPCIONISTA)
    API->>DB: cria OS (status=RECEIVED)
    API->>API: eventos OrdemServicoCriada + OrdemServicoRecebida<br/>(esta última coloca a OS na fila de diagnóstico do Execução)
    API-->>Recepcionista: 201 { id da OS }

    Mecanico->>Exec: PATCH /api/v1/execucoes/{id}/iniciar-diagnostico (papel MECANICO)
    Exec-->>API: evento DiagnosticoIniciado
    API->>DB: status=UNDER_DIAGNOSIS (ignora se a OS já não está em RECEIVED)
    API->>API: evento OrdemServicoEmDiagnostico (notifica o cliente)

    Mecanico->>API: PATCH /ordens-servico/:id/servicos-insumos<br/>(lista serviços + peças, papel MECANICO; exige UNDER_DIAGNOSIS)
    API-->>Mecanico: 200 { totais calculados }
    API->>API: evento OrcamentoCalculado → OrcamentoGerado + OrdemDeServicoAguardandoAprovacao
    API->>DB: persiste Orçamento, status=AWAITING_APPROVAL
    API-->>Cliente: notifica orçamento (fora do sistema — e-mail/telefone, não modelado como integração)

    alt Cliente aprova
        Cliente->>API: PATCH /ordens-servico/:id/orcamento/aprovar (rota @Public, sem token)
        API->>API: evento OrcamentoAprovado (reserva as peças)
        Note over API,DB: A OS permanece em AWAITING_APPROVAL.<br/>Peça sem estoque: apenas marca reserva_pecas_pendente.
        Mecanico->>Exec: PATCH /api/v1/execucoes/{id}/iniciar-reparo (papel MECANICO, após PagamentoConfirmado)
        Exec-->>API: evento ExecucaoIniciada
        API->>API: evento OrdemServicoEmExecucao
        API->>DB: status=IN_PROGRESS, iniciada_em=now()
    else Cliente recusa
        Cliente->>API: PATCH /ordens-servico/:id/orcamento/recusar (rota @Public, sem token)
        API->>API: evento OrcamentoRejeitado
        API->>DB: status=CLOSED_WITHOUT_EXECUTION
        Note over API,DB: Nenhum evento de domínio nomeado para esta<br/>transição em ddd.md §5.1 — gap já registrado<br/>na auditoria (Fase 3 não introduz nem resolve isso)
    end

    opt Reserva de peças pendente (peça sem estoque)
        API->>DB: logo após IN_PROGRESS, status=AWAITING_PARTS
        Note over API,DB: Duas gravações: não existe transição direta<br/>AWAITING_APPROVAL → AWAITING_PARTS
        API->>DB: peças repostas (PecasReservadas) → status=IN_PROGRESS
    end

    Mecanico->>Exec: PATCH /api/v1/execucoes/{id}/concluir (papel MECANICO)
    Exec-->>API: evento ExecucaoConcluida
    API->>API: evento OrdemDeServicoFinalizada
    API->>DB: status=FINISHED, finalizada_em=now()

    Cliente->>API: PATCH /ordens-servico/:id/aprovar-servico (rota @Public, sem token)

    Cliente->>Recepcionista: Retira o veículo (fora do sistema)
    Recepcionista->>API: PATCH /ordens-servico/:id/registrar-entrega (papel RECEPCIONISTA)
    API->>API: evento OrdemDeServicoEntregue
    API->>DB: status=DELIVERED, entregue_em=now()
    API-->>Cliente: confirmação de entrega

    par Observabilidade [PENDENTE]
        API-->>Obs: [PENDENTE — nenhuma ferramenta decidida]
    end
```

## Integração com o contexto Financeiro

Até a Feature #330, `POST /pagamentos/registrar` disparava a entrega da OS
por um evento `PagamentoRegistrado`, e `registrar-entrega` emitia esse mesmo
evento sem existir pagamento. A #330 removeu os dois: hoje
`PATCH /ordens-servico/:id/registrar-entrega` é o **único** caminho de
escrita para `DELIVERED` (exige `FINISHED`, grava `entregue_em` e uma linha
de histórico), e o webhook `POST /webhooks/service-orders/status` rejeita
`DELIVERED` com `400`.

**Mercado Pago no monólito (Feature #325, 20/10/2026).** Antes do Billing
Service existir, a cobrança já roda no módulo `financeiro`:

- `PATCH /ordens-servico/:id/orcamento/aprovar` (e `POST /:id/aprovar-servico`
  com `APROVADO`) cria a preference do Checkout Pro **antes** de marcar o
  orçamento `APPROVED` e devolve `linkPagamento`. Falha no Mercado Pago →
  `502` e o orçamento segue `PENDING`. A chamada passa pela porta
  `ICobrancaPagamentoPort` (`src/shared/domain/interfaces`). Uma cobrança por
  OS (`Pagamento.ordemServicoId` único, reservado antes de chamar o Mercado
  Pago); aprovações concorrentes devolvem o mesmo link e só uma publica
  `OrcamentoAprovado`.
- `POST /api/v1/webhooks/mercado-pago` valida o `x-signature`, reconsulta
  `GET /v1/payments/{id}` e grava a notificação em `webhook_recebido` na mesma
  transação do `Pagamento`: aprovado com o valor da cobrança → `CONFIRMADO` +
  `PagamentoConfirmadoEvent`; `rejected`/`cancelled` → `RECUSADO` +
  `PagamentoRecusadoEvent` (terminal, simplificação da ADR-0022); pendente →
  sem efeito. Esses eventos in-process do monólito não têm consumidor.
- O OS Service consome `PagamentoConfirmado` do Billing pelo Kafka
  (`RegistrarPagamentoConfirmadoHandler`, #331): grava `pago_em` e uma linha
  em `HistoricoStatusOS`, **sem mudar status**, e não é gatilho da entrega.
- Diferença em relação ao fluxo da Fase 4 descrito abaixo: a OS não espera o
  pagamento para sair de `AWAITING_APPROVAL` (só `ExecucaoIniciada` a leva a
  `IN_PROGRESS`, e ela só chega do Execução).

### Integração com o contexto Financeiro (Fase 4) {#integração-com-o-contexto-financeiro-fase-4}

**Decidido na revisão de 30/09/2026: não há checagem de pagamento em
`registrar-entrega`.** A decisão de 22/09/2026 (validar um `Pagamento`
confirmado antes de aceitar `DELIVERED`) foi **cortada**.

- "Entrega" aqui é a devolução do veículo ao cliente, ato presencial
  registrado por `PATCH /ordens-servico/:id/registrar-entrega` (papel
  RECEPCIONISTA), como já mostra o diagrama acima. Continua acionado
  manualmente pelo Recepcionista; o pagamento **não** dispara a transição
  para `DELIVERED`.
- Na Fase 4 o `Pagamento` pertence ao Billing Service; o OS Service não o
  tem e guarda só o marcador `pago_em` (usado pelo detector de OS parada,
  [`saga-flow.md` §2](./saga-flow.md)). Validar a entrega exigiria uma chamada REST entre serviços, que a
  Fase 4 não tem: toda a coordenação é por evento.
- A checagem seria sempre verdadeira: a OS só chega a `FINISHED` depois de
  `ExecucaoConcluida`, que só existe depois de `iniciar-reparo`
  (`ExecucaoIniciada`), que só é possível depois de `PagamentoConfirmado`. O OS Service aceita `registrar-entrega`
  para qualquer OS em `FINISHED`.
- Existe **um único pagamento**, cobrado na etapa de aprovação do orçamento
  (Checkout Pro), antes de `IN_PROGRESS`; não há sinal + saldo nem segundo
  momento de cobrança. Detalhes em
  [ADR-0016](../adr/0016-saga-coreografada.md) e
  [`saga-flow.md` §4](./saga-flow.md).

## Erros e fluxos alternativos cobertos pela API (evidência: tabela de rotas do README)

| Situação | Comportamento |
|---|---|
| Papel sem permissão (ex.: RECEPCIONISTA tentando `servicos-insumos`) | 403 Forbidden (`RolesGuard`) |
| Token ausente/expirado/inválido em rota não-`@Public()` | 401 Unauthorized (`JwtAuthGuard`) |
| `servicos-insumos` com a OS fora de `UNDER_DIAGNOSIS` (ex.: `DiagnosticoIniciado` ainda não processado) | 400 (`DomainException`); o mecânico repete depois |
| `servicos-insumos` com valor negativo | 400 (`GerarOrcamentoDto`: `valor_total_servicos` e `valor_total_pecas` com `@Min(0)`) |

## Consulta de status

`GET /ordens-servico/:id/status` e `GET /ordens-servico/tempo-medio` (papel
ADMIN) são consultas, não alteram o fluxo principal — incluídas para
completude do mapeamento endpoint↔estado.

## Relação com a arquitetura da Fase 3 (monólito)

Este fluxo roda **inteiramente dentro do Bounded Context `ordem-servico`, no
mesmo monólito**, hoje e na arquitetura da Fase 3 — a separação em quatro
repositórios não o altera. A única mudança é *como* a requisição chega até a
aplicação (via API Gateway + Lambda Authorizer, em vez de acesso direto) —
ver [authentication-flow.md](./authentication-flow.md) e
[overview.md §4](./overview.md#4-comunicação-entre-bounded-contexts).

## Relação com a arquitetura da Fase 4

Deixa de ser verdade que este fluxo roda "inteiramente" num único processo:
com a divisão em microsserviços (`docs/architecture/service-boundaries.md`),
`Orcamento` e `Pagamento` passam a viver no Billing Service, em banco
separado do OS Service. As transições `AWAITING_APPROVAL` → aprovação/recusa
do orçamento e o pagamento passam a cruzar a fronteira de serviço **somente
por evento** (Saga coreografada, sem chamada REST entre serviços); o fluxo
distribuído está em [`saga-flow.md`](./saga-flow.md). O diagrama de sequência
acima continua correto como fluxo de **negócio** do monólito atual; deixa de
ser preciso como fluxo de **um único processo** a partir da Fase 4. Na Fase 4
as rotas públicas `POST /ordens-servico/:id/aprovar-servico` e
`GET /ordens-servico/:id/rastreamento` são removidas (a primeira era uma
terceira via de aprovação que pulava o pagamento; a segunda é alias de
`/status`), e a aprovação/recusa passa a ser
`PATCH /api/v1/orcamentos/{ordemServicoId}/aprovar|recusar` no Billing Service.
Também migram para o Execução e Produção as ações do mecânico: `assumir` e
`analisar` viram `PATCH /api/v1/execucoes/{id}/iniciar-diagnostico` e
`finalizar-execucao` vira `PATCH /api/v1/execucoes/{id}/concluir`, com a
nova `iniciar-reparo` entre elas; `servicos-insumos` e `registrar-entrega`
ficam no OS Service ([`saga-flow.md` §2](./saga-flow.md)). No código do OS
Service (Feature #334) as três rotas já foram removidas e o diagrama acima
mostra o fluxo resultante; enquanto o Execução não existe, nada emite
`DiagnosticoIniciado`, `ExecucaoIniciada` nem `ExecucaoConcluida` e a OS não
avança além de `RECEIVED`/`AWAITING_APPROVAL` — ver
[`os-service-integracao-execucao.md`](./os-service-integracao-execucao.md) §5.

### Coreografia do serviço Execução e Produção

O diagrama acima permanece como sequência do monólito; não representa a
execução distribuída da Fase 4. Nesta, o Execução e Produção consome
`OrdemServicoRecebida` e cria a `Execucao` na fila
`AGUARDANDO_DIAGNOSTICO`; reentrega para a mesma OS não cria outra execução.
Quando o mecânico inicia o diagnóstico, publica `DiagnosticoIniciado`. Depois
disso, `PagamentoConfirmado` move `EM_DIAGNOSTICO` para
`AGUARDANDO_REPARO`, sem publicar evento; execução ausente ou ainda em
`AGUARDANDO_DIAGNOSTICO` é retentável, e estado já alcançado ou posterior é
ignorado. O início do reparo pelo mecânico publica `ExecucaoIniciada`, e a
conclusão publica `ExecucaoConcluida`.

`OrcamentoRecusado` e `PagamentoRecusado` cancelam a execução, assim como
`EtapaDaSagaFalhou` exceto quando `etapa=reparo`. O cancelamento só se aplica
antes de `EM_REPARO`; eventos para execução inexistente, terminal ou já em
reparo são reconhecidos e ignorados. As transições protegidas pelo estado
atual tornam o consumo idempotente, sem criar ou depender de uma tabela de
mensagens processadas; o model `ProcessedEvent` herdado do scaffold não é
usado por este fluxo. Logs de consumo registram `eventId` e
`ordemServicoId` (`correlationId`), conforme contrato da
[ADR-0018](../adr/0018-mensageria-contratos-eventos.md).

O webhook existente `POST /api/v1/webhooks/service-orders/status` permanece
como fallback documentado, exceto para `DELIVERED`, que ele rejeita (a
entrega só passa por `registrar-entrega`). A publicação após commit tem a janela aceita de
perda entre persistência e publicação; não há garantia de outbox. O fluxo
completo, a matriz de falhas e os contratos de eventos estão em
[`saga-flow.md`](./saga-flow.md) e [`event-catalog.md`](./event-catalog.md).

> **Revisão de 30/09/2026 (`rev/Epic_1`).** Atualizadas apenas as seções de
> integração com o Financeiro e de arquitetura da Fase 4, alinhadas a
> [`saga-flow.md`](./saga-flow.md) (fonte única do fluxo distribuído). O
> diagrama descrevia o monólito antes da Feature #334 e foi atualizado por
> ela (ações do mecânico via Execução e Produção). Observação: o diagrama mostra `PATCH .../aprovar-servico` como
> `@Public`, mas no código esse `PATCH` é autenticado (a rota pública é o
> `POST` de mesmo path).
