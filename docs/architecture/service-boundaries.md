# Fronteiras dos Microsserviços e Ownership de Dados (Fase 4)

> Este documento fecha a Feature #307 ("Definir Divisão de Microsserviços e
> Ownership de Dados"), filha do Epic #306 ("Arquitetura Alvo da Fase 4"). É
> um documento **de decisão já fechada pelo grupo em 21/09/2026** (ver
> `fase4-decisoes-epico1.md`, F1, fora do repositório) — formaliza a divisão,
> não a propõe. Convenções de marcação: `[DECIDIDO]` para o que já foi
> fechado pelo grupo e não deve ser reaberto sem justificativa nova;
> `[PENDENTE]` para o que ainda depende de uma Feature futura.

## 1. Os três serviços

A Fase 4 exige "no mínimo 3 microsserviços independentes, cada um com seu
próprio repositório, infraestrutura e banco de dados" (enunciado, p.2). A
divisão escolhida segue os exemplos sugeridos no próprio enunciado (p.3):

| Serviço | Repositório | Status do repositório | Contexto de negócio |
|---|---|---|---|
| **OS Service** | `async-furious-project` (este repositório, reaproveitado — **não é repositório novo**) | **[ATUAL]** já existe | Ciclo de vida completo da Ordem de Serviço: abertura, diagnóstico, orçamentação (cálculo), aprovação/recusa do cliente, execução, controle de peças/insumos e cadastro de clientes/veículos |
| **Billing Service** | novo — issue [#323](https://github.com/Async-And-Furious/async-furious-project/issues/323), dentro do Epic [#322](https://github.com/Async-And-Furious/async-furious-project/issues/322) | **[PENDENTE]** ainda não criado | Geração e persistência do orçamento (o documento financeiro, não o cálculo), aprovação/recusa expostas como API pública, registro de pagamento e integração com o Mercado Pago |
| **Execução e Produção** | novo — issue [#319](https://github.com/Async-And-Furious/async-furious-project/issues/319), dentro do Epic [#318](https://github.com/Async-And-Furious/async-furious-project/issues/318) | **[PENDENTE]** ainda não criado | Fila de execução por prioridade, diagnóstico/reparo em andamento e apontamentos do mecânico responsável — nasce sem herdar nenhum model do monólito |

**Fora do escopo desta Feature** (registrado explicitamente na issue #307):
criação dos dois repositórios novos e da infraestrutura correspondente (Epic
#312 — Fundação de Plataforma Distribuída), implementação da extração de
código (Epics #322 e #318), migração de dados existentes e contratos de
evento entre os serviços (Feature #309).

> **Nota de escopo (confirmada com o solicitante em 22/09/2026):** a
> contagem de "repositórios novos" para a Fase 4 é **2** (Billing + Execução)
> — o OS Service reaproveita `async-furious-project`. Uma leitura anterior
> de que seriam "3 a 4 repositórios novos" foi confirmada como engano de
> memória e descartada; a divisão em 3 serviços / 2 repositórios novos segue
> como está fechada em `fase4-decisoes-epico1.md` (F1) e não foi reaberta.

### 1.1. OS Service

Herda os módulos `ordem-servico`, `cadastro` e `pecas-insumos` do monólito
atual (`docs/adr/0010-monolito-modular.md`, agora superseded — ver
[ADR-0017](../adr/0017-divisao-microsservicos-ownership-dados.md)).
Permanece com PostgreSQL como lado de escrita e ganha o DynamoDB como lado
de leitura (CQRS de `OrdemServico` e `Cliente`, decisão F4/4.1-4.5 do
`fase4-decisoes-epico1.md` — fora do escopo desta Feature, tratado em
Feature própria de Persistência, #310).

### 1.2. Billing Service

Nasce da extração do módulo `financeiro` do monólito, **somado ao
`Orcamento`**, que hoje vive dentro de `ordem-servico` (ver §3 — FKs que
cruzam fronteira). PostgreSQL próprio, sem DynamoDB (decisão registrada em
#323: "nenhuma dependência de DynamoDB... presente no `package.json`").

### 1.3. Execução e Produção

Único dos três sem models herdados — o schema nasce vazio. A modelagem do
agregado de execução (fila, diagnóstico, reparo, apontamento) é escopo da
Feature #320 ("Fila de Execução e Domínio de Produção"), não desta. PostgreSQL
próprio, sem NoSQL (decisão registrada em #319, revisão da hipótese antiga de
que o Execução levaria o NoSQL — caiu junto com a escolha de saga
coreografada, F4/4.1).

## 2. Mapa de Ownership — todos os models do `prisma/schema.prisma`

> **Nota factual:** a issue #307 fala em "16 models". A contagem real no
> `prisma/schema.prisma` atual (commit `develop` na data deste documento) é
> **14 models** (`User`, `Cliente`, `Veiculo`, `OrdemServico`, `Orcamento`,
> `Peca`, `Servico`, `OsPeca`, `OsServico`, `PedidoFornecedor`,
> `PedidoFornecedorItem`, `ReservaEstoque`, `Pagamento`, `HistoricoStatusOS`).
> Sinalizando a divergência em vez de inventar 2 models para bater com o
> número da issue — se os 16 vierem de uma contagem que inclui os 3 `enum`
> (`TaxIdType`, `SOStatus`, `EstimateStatus`), o número bate; se não, é
> imprecisão do texto da issue a confirmar com o grupo.

| Model | Módulo atual | Serviço dono (Fase 4) | Observação |
|---|---|---|---|
| `Cliente` | `cadastro` | **OS Service** | — |
| `Veiculo` | `cadastro` | **OS Service** | — |
| `Servico` | `cadastro` | **OS Service** | catálogo de serviços oferecidos (não confundir com "serviço" no sentido de microsserviço) |
| `OrdemServico` | `ordem-servico` | **OS Service** | fonte da verdade (lado de escrita); ganha réplica de leitura em DynamoDB (F4, fora do escopo aqui) |
| `HistoricoStatusOS` | `ordem-servico` | **OS Service** | FK interna a `OrdemServico`, não cruza fronteira |
| `OsPeca` | `ordem-servico` × `pecas-insumos` | **OS Service** | módulo-cruzado, mas dentro do mesmo serviço — sem mudança |
| `OsServico` | `ordem-servico` × `cadastro` | **OS Service** | idem |
| `Peca` | `pecas-insumos` | **OS Service** | — |
| `PedidoFornecedor` | `pecas-insumos` | **OS Service** | — |
| `PedidoFornecedorItem` | `pecas-insumos` | **OS Service** | — |
| `ReservaEstoque` | `pecas-insumos` | **OS Service** | já sem FK declarada no Prisma (`ordem_id`, `peca_id` como campos soltos) |
| `Orcamento` | `ordem-servico` (**migra**) | **Billing Service** | decisão 1.4 do `fase4-decisoes-epico1.md` — ver §3 |
| `Pagamento` | `financeiro` | **Billing Service** | já referenciava `OrdemServico` só por id (`ordemServicoId String`, sem `@relation`) — nenhuma mudança de modelagem necessária, só de banco/repositório |
| `User` | `auth` (transversal) | **OS Service** `[PENDENTE — ver nota]` | ver nota abaixo |
| — | — | **Execução e Produção** | nasce sem nenhum model herdado (schema vazio); modelagem em Feature #320 |

**Nota sobre `User`:** a Fase 4 decidiu (F5/5.1 do `fase4-decisoes-epico1.md`)
migrar 100% da autenticação para o Lambda Authorizer da borda
(`repo-auth-serverless`), o que supera `docs/adr/0008-autenticacao-local-jwt-rbac.md`.
Essa ADR **não é revisada por esta Feature** — é escopo da Feature de
Topologia de Infraestrutura e Borda (#311). Por isso este documento atribui
`User` ao OS Service apenas como posição provisória (é onde a tabela existe
hoje), **sem fechar** se cada serviço nasce com sua própria cópia local de
`User` (fallback de dev HS256, per `AGENTS.md`) ou se o model é descontinuado
inteiramente. Fica registrado como pendência para a Feature #311 — não é
"tabela sem dono": é dono provisório com nota explícita, para não travar o
critério de aceite desta Feature ("nenhuma tabela sem dono").

## 3. FKs que cruzam fronteira de serviço

| Origem | Referência | Situação hoje | Decisão Fase 4 |
|---|---|---|---|
| `Orcamento.id_ordem_servico` | `OrdemServico.id` | `@relation(..., onDelete: Cascade)` — FK real no Postgres, deleção de OS cascade-deleta o Orçamento | **Vira referência por id, sem FK.** Campo passa a ser `ordemServicoId String` (sem `@relation`), no mesmo padrão que `Pagamento.ordemServicoId` já usa hoje. **Consequência assumida:** deletar uma `OrdemServico` no OS Service deixa de cascatear para o `Orcamento` no Billing Service — se isso for necessário, vira evento de domínio consumido pelo Billing (fora do escopo desta Feature, tratado em #309/#331) |
| `Pagamento.ordemServicoId` | `OrdemServico.id` | Já é `String` solto, sem `@relation` — nenhuma FK a remover | **Nenhuma mudança de modelagem.** Muda só de banco físico (RDS único → banco `billing` isolado por credencial, Epic #312) |

Nenhuma outra FK do schema atual cruza a fronteira OS Service / Billing
Service / Execução. As referências dentro do OS Service (`OsPeca`,
`OsServico`, `HistoricoStatusOS` → `OrdemServico`) continuam com FK real —
ficam dentro do mesmo banco e do mesmo serviço.

## 4. Regra pagamento → entrega da OS

Tratada com o detalhe completo em
[`service-order-flow.md`](./service-order-flow.md#integração-com-o-contexto-financeiro-fase-4)
— aqui fica só o resumo decidido: **pagamento aprovado é pré-requisito para
o registro de entrega** (`PATCH /ordens-servico/:id/registrar-entrega`), não
gatilho automático dela. Ver naquele documento a divergência sinalizada em
relação à sequência de Saga já registrada em `fase4-decisoes-epico1.md` (F2,
2.2), que não foi resolvida por esta Feature — fica para validação do grupo.

## 5. Documentação e ADRs derivadas desta Feature

- [ADR-0017 — Divisão em três microsserviços e ownership de dados](../adr/0017-divisao-microsservicos-ownership-dados.md) (nova).
- `docs/adr/0010-monolito-modular.md` — marcada como **Substituída**, aponta
  para a ADR-0017.
- `docs/adr/0011-aprovacao-orcamento-api-publica.md` — revisada com a seção
  de migração do `Orcamento` para o Billing Service.

## 6. Pendências para validação do grupo (DoD desta Feature exige validação)

1. Confirmar o dono provisório de `User` (§2) — ou fechar isso já dentro da
   Feature #311, que trata da borda.
2. Confirmar a semântica pagamento → entrega documentada em
   `service-order-flow.md` **e** resolver (ou aceitar conscientemente) a
   divergência com a sequência de Saga (`abrir OS → orçamento → aprovação →
   pagamento → execução iniciada`), que posiciona o pagamento **antes** da
   execução, não depois dela.
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
