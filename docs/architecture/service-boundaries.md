# Fronteiras dos Microsserviços e Ownership de Dados (Fase 4)

> Este documento fecha a Feature #307 ("Definir Divisão de Microsserviços e
> Ownership de Dados"), filha do Epic #306 ("Arquitetura Alvo da Fase 4"). É
> um documento **de decisão já fechada pelo grupo em 21/09/2026** (ver
> `fase4-decisoes-epico1.md`, F1, fora do repositório) — formaliza a divisão,
> não a propõe. Convenções de marcação: `[DECIDIDO]` para o que já foi
> fechado pelo grupo e não deve ser reaberto sem justificativa nova;
> `[PENDENTE]` para o que ainda depende de uma Feature futura.
>
> **Revisão de 30/09/2026 (`rev/Epic_1`).** Alinhado a
> [`saga-flow.md`](./saga-flow.md) (fonte única do fluxo). O Execução e
> Produção passa ao **modelo híbrido mínimo** (fila de diagnóstico e de
> reparo, ações do mecânico `iniciar-diagnostico`, `iniciar-reparo` e
> `concluir`); `assumir`/`analisar` e `finalizar-execucao` migram do OS
> Service para ele e `servicos-insumos` fica no OS Service (§1.3); a
> checagem de pagamento em `registrar-entrega` foi **cortada** (§4); o OS
> Service ganha a coluna `pago_em` em `OrdemServico` (§2); rotas de
> orçamento com `{ordemServicoId}`.

## 1. Os três serviços

A Fase 4 exige "no mínimo 3 microsserviços independentes, cada um com seu
próprio repositório, infraestrutura e banco de dados" (enunciado, p.2). A
divisão escolhida segue os exemplos sugeridos no próprio enunciado (p.3):

| Serviço | Repositório | Status do repositório | Contexto de negócio |
|---|---|---|---|
| **OS Service** | `async-furious-project` (este repositório, reaproveitado — **não é repositório novo**) | **[ATUAL]** já existe | Ciclo de vida (`SOStatus`) da Ordem de Serviço: abertura, definição dos serviços/peças e cálculo do orçamento, reserva de peças, status refletido por evento (diagnóstico, aprovação/recusa do cliente, execução), entrega, controle de peças/insumos e cadastro de clientes/veículos |
| **Billing Service** | novo — issue [#323](https://github.com/Async-And-Furious/async-furious-project/issues/323), dentro do Epic [#322](https://github.com/Async-And-Furious/async-furious-project/issues/322) | **[PENDENTE]** ainda não criado | Geração e persistência do orçamento (o documento financeiro, não o cálculo), aprovação/recusa expostas como API pública, registro de pagamento e integração com o Mercado Pago |
| **Execução e Produção** | novo — issue [#319](https://github.com/Async-And-Furious/async-furious-project/issues/319), dentro do Epic [#318](https://github.com/Async-And-Furious/async-furious-project/issues/318) | **[PENDENTE]** ainda não criado | Fila de execução da OS (diagnóstico e reparo), status durante diagnóstico e reparo e conclusão comunicada ao OS Service — nasce sem herdar nenhum model do monólito |

**Fora do escopo desta Feature** (registrado explicitamente na issue #307):
criação dos dois repositórios novos e da infraestrutura correspondente (Epic
#312 — Fundação de Plataforma Distribuída), implementação da extração de
código (Epics #322 e #318), migração de dados existentes e contratos de
evento entre os serviços (Feature #309).

> **Escopo:** a Fase 4 cria **2** repositórios novos (Billing e Execução);
> o OS Service reaproveita o `async-furious-project`.

### 1.1. OS Service

Herda os módulos `ordem-servico`, `cadastro` e `pecas-insumos` do monólito
atual (`docs/adr/0010-monolito-modular.md`, agora superseded — ver
[ADR-0017](../adr/0017-divisao-microsservicos-ownership-dados.md)).
Permanece com PostgreSQL como lado de escrita e ganha o DynamoDB como lado
de leitura (CQRS de `OrdemServico` e `Cliente`, decisão F4/4.1-4.5 do
`fase4-decisoes-epico1.md` — modelo de dados completo fechado pela Feature
#310, ver [`persistence-model.md`](./persistence-model.md) e
[ADR-0019](../adr/0019-dynamodb-read-model-os-cliente.md)).

### 1.2. Billing Service

Nasce da extração do módulo `financeiro` do monólito, **somado ao
`Orcamento`**, que hoje vive dentro de `ordem-servico` (ver §3 — FKs que
cruzam fronteira). PostgreSQL próprio, sem DynamoDB (decisão registrada em
#323: "nenhuma dependência de DynamoDB... presente no `package.json`").

### 1.3. Execução e Produção

Único dos três sem models herdados — o schema nasce vazio. A modelagem do
agregado `Execucao` é escopo da Feature #320 ("Fila de Execução e Domínio de
Produção"), não desta. PostgreSQL próprio, sem NoSQL (decisão registrada em
#319, revisão da hipótese antiga de que o Execução levaria o NoSQL — caiu
junto com a escolha de saga coreografada, F4/4.1).

**Responsabilidades (modelo híbrido mínimo).** O enunciado (p.3) atribui ao
serviço "gerenciar a fila de execução da OS", "atualizar status durante
diagnóstico e reparos" e "comunicar finalização ao OS Service". Por isso o
serviço:

- consome `OrdemServicoRecebida` e cria a `Execucao` em
  `AGUARDANDO_DIAGNOSTICO` (fila);
- expõe `GET /api/v1/execucoes?status=...` (fila, ordem por `createdAt`);
- `PATCH /api/v1/execucoes/{id}/iniciar-diagnostico` → `EM_DIAGNOSTICO`,
  publica `DiagnosticoIniciado`;
- consome `PagamentoConfirmado` → `AGUARDANDO_REPARO`, sem publicar evento;
- `PATCH /api/v1/execucoes/{id}/iniciar-reparo` → `EM_REPARO`, publica
  `ExecucaoIniciada`;
- `PATCH /api/v1/execucoes/{id}/concluir` → `CONCLUIDA`, publica
  `ExecucaoConcluida`;
- consome `OrcamentoRecusado`, `PagamentoRecusado` e `EtapaDaSagaFalhou`
  (exceto `etapa=reparo`) → `CANCELADA` (sai da fila).

Ciclo: `AGUARDANDO_DIAGNOSTICO` → `EM_DIAGNOSTICO` → `AGUARDANDO_REPARO` →
`EM_REPARO` → `CONCLUIDA`; `CANCELADA` a partir de `AGUARDANDO_DIAGNOSTICO`,
`EM_DIAGNOSTICO` ou `AGUARDANDO_REPARO` (reparo iniciado não é cancelado; ver
`saga-flow.md` §3). Fora da Fase 4: pausa por peça no Execução, rejeição de apontamento
e reposição.

**Rotas que migram do OS Service**: `assumir` e `analisar` →
`iniciar-diagnostico`; `finalizar-execucao` → `concluir`. **Ficam no OS
Service**: `PATCH /api/v1/ordens-servico/{id}/servicos-insumos` (listar
serviços/peças e calcular o orçamento — dependem de `Servico` e `Peca`) e
`registrar-entrega`.

## 2. Mapa de Ownership — todos os models do `prisma/schema.prisma`

> **Contagem:** o `prisma/schema.prisma` tem **14 models** (`User`, `Cliente`,
> `Veiculo`, `OrdemServico`, `Orcamento`, `Peca`, `Servico`, `OsPeca`,
> `OsServico`, `PedidoFornecedor`, `PedidoFornecedorItem`, `ReservaEstoque`,
> `Pagamento`, `HistoricoStatusOS`). O texto original da #307 citava 16.

| Model | Módulo atual | Serviço dono (Fase 4) | Observação |
|---|---|---|---|
| `Cliente` | `cadastro` | **OS Service** | — |
| `Veiculo` | `cadastro` | **OS Service** | — |
| `Servico` | `cadastro` | **OS Service** | catálogo de serviços oferecidos (não confundir com "serviço" no sentido de microsserviço) |
| `OrdemServico` | `ordem-servico` | **OS Service** | fonte da verdade (lado de escrita); ganha réplica de leitura em DynamoDB (F4, fora do escopo aqui) e a coluna `pago_em` (`nullable`, gravada ao consumir `PagamentoConfirmado`, sem mudar o status; usada só pelo detector de OS parada) |
| `HistoricoStatusOS` | `ordem-servico` | **OS Service** | FK interna a `OrdemServico`, não cruza fronteira |
| `OsPeca` | `ordem-servico` × `pecas-insumos` | **OS Service** | módulo-cruzado, mas dentro do mesmo serviço — sem mudança |
| `OsServico` | `ordem-servico` × `cadastro` | **OS Service** | idem |
| `Peca` | `pecas-insumos` | **OS Service** | — |
| `PedidoFornecedor` | `pecas-insumos` | **OS Service** | — |
| `PedidoFornecedorItem` | `pecas-insumos` | **OS Service** | — |
| `ReservaEstoque` | `pecas-insumos` | **OS Service** | já sem FK declarada no Prisma (`ordem_id`, `peca_id` como campos soltos) |
| `Orcamento` | `ordem-servico` (**migra**) | **Billing Service** | decisão 1.4 do `fase4-decisoes-epico1.md` — ver §3 |
| `Pagamento` | `financeiro` | **Billing Service** | já referenciava `OrdemServico` só por id (`ordemServicoId String`, sem `@relation`) — nenhuma FK a remover; ganha `@unique` em `ordemServicoId` (idempotência da aprovação) e os campos da cobrança (`preferenceId`, `initPoint`, status `AGUARDANDO_PAGAMENTO`/`CONFIRMADO`/`RECUSADO`/`CANCELADO`, ver `saga-flow.md`), além da mudança de banco/repositório |
| `User` | `auth` (transversal) | **OS Service** `[DECIDIDO — ver nota]` | ver nota abaixo |
| — | — | **Execução e Produção** | nasce sem nenhum model herdado (schema vazio); modelagem em Feature #320 |

**Nota sobre `User`:** a [ADR-0021](../adr/0021-borda-sem-bff.md) (Feature #311)
mantém a autenticação em duas camadas: Lambda Authorizer na borda e validação
local do JWT em cada serviço, com RBAC local. O login de staff
(`POST /api/v1/auth/login`) e o model `User` permanecem no OS Service, que é
onde a tabela existe hoje; Billing e Execução e Produção só validam o token e
não têm `User`.

## 3. FKs que cruzam fronteira de serviço

| Origem | Referência | Situação hoje | Decisão Fase 4 |
|---|---|---|---|
| `Orcamento.id_ordem_servico` | `OrdemServico.id` | `@relation(..., onDelete: Cascade)` — FK real no Postgres, deleção de OS cascade-deleta o Orçamento | **Vira referência por id, sem FK.** Campo passa a ser `ordemServicoId String` (sem `@relation`), no mesmo padrão que `Pagamento.ordemServicoId` já usa hoje. **Consequência assumida:** deletar uma `OrdemServico` no OS Service deixa de cascatear para o `Orcamento` no Billing Service — aceito na Fase 4 sem evento de deleção (o catálogo `event-catalog.md` não prevê um); a extração do `Orcamento` é da #330 |
| `Pagamento.ordemServicoId` | `OrdemServico.id` | Já é `String` solto, sem `@relation` — nenhuma FK a remover | **Nenhuma FK a remover.** Muda de banco lógico (`os_service` → `billing`, na mesma instância RDS, isolado por credencial, Epic #312) |

Nenhuma outra FK do schema atual cruza a fronteira OS Service / Billing
Service / Execução. As referências dentro do OS Service (`OsPeca`,
`OsServico`, `HistoricoStatusOS` → `OrdemServico`) continuam com FK real —
ficam dentro do mesmo banco e do mesmo serviço.

## 4. Regra pagamento → entrega da OS

Tratada com o detalhe completo em
[`service-order-flow.md`](./service-order-flow.md#integração-com-o-contexto-financeiro-fase-4)
— aqui fica só o resumo decidido: **não há checagem de pagamento em
`registrar-entrega`** (`PATCH /ordens-servico/:id/registrar-entrega`); ela foi
cortada na revisão de 30/09/2026. O pagamento não dispara a entrega, e a OS só
chega a `FINISHED` depois de `PagamentoConfirmado`. A relação com a sequência
de Saga (`fase4-decisoes-epico1.md`, F2/2.2) foi resolvida pela
[ADR-0016](../adr/0016-saga-coreografada.md): um único pagamento, cobrado
antes da execução.

## 5. Documentação e ADRs derivadas desta Feature

- [ADR-0017 — Divisão em três microsserviços e ownership de dados](../adr/0017-divisao-microsservicos-ownership-dados.md) (nova).
- `docs/adr/0010-monolito-modular.md` — marcada como **Substituída**, aponta
  para a ADR-0017.
- `docs/adr/0011-aprovacao-orcamento-api-publica.md` — revisada com a seção
  de migração do `Orcamento` para o Billing Service.

## 6. Pendências para validação do grupo (DoD desta Feature exige validação)

1. ~~Confirmar o dono provisório de `User` (§2)~~ — **resolvido** pela
   [ADR-0021](../adr/0021-borda-sem-bff.md) (Feature #311): `User` e o login de
   staff permanecem no OS Service.
2. ~~Resolver a divergência entre a regra pagamento → entrega e a sequência
   de Saga~~ — **resolvida** pela [ADR-0016](../adr/0016-saga-coreografada.md)
   (Feature #308): pagamento único antes da execução; a checagem de pagamento
   na entrega foi cortada.
3. Validar que a contagem "14 models" (não 16) não esconde nenhuma tabela
   fora do `schema.prisma` que devesse entrar neste mapa.

## 7. Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.2, p.3 e p.4
- `fase4-decisoes-epico1.md`, seção F1 e F4 (fora do repositório, workspace local do grupo)
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- Issue [#307](https://github.com/Async-And-Furious/async-furious-project/issues/307) — esta Feature
- [`docs/adr/0010-monolito-modular.md`](../adr/0010-monolito-modular.md), [`docs/adr/0011-aprovacao-orcamento-api-publica.md`](../adr/0011-aprovacao-orcamento-api-publica.md)
- [`docs/architecture/service-order-flow.md`](./service-order-flow.md)
- [`docs/ddd.md`](../ddd.md)
- `prisma/schema.prisma`
