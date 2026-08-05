# Banco de Dados

> Documenta a camada de persistência e o modelo de dados da aplicação, para
> a demanda "Elaborar Documentação da Persistência e Modelo de Dados" da
> Fase 3. Este arquivo está sendo escrito em paralelo à
> [PR #175](https://github.com/Async-And-Furious/async-furious-project/pull/175)
> (`doc/ArchDocs_diagrams`), que já criou um `docs/infrastructure/database.md`
> próprio com o estado por ambiente. As duas versões vão precisar de
> reconciliação manual quando uma das branches for mesclada primeiro.

## Estado por ambiente

| Ambiente | Onde roda | Versão | Evidência |
| --- | --- | --- | --- |
| Dev local (`docker compose`) | `docker-compose.dependencies.yml` | `postgres:15-alpine` | `docker-compose.dependencies.yml:3` |
| CI (`tests.yml`) | Serviço containerizado no runner | `postgres:16` | `.github/workflows/tests.yml:18` |
| Kubernetes local (`kind`) | `StatefulSet` | `postgres:15-alpine` | `k8s/database/statefulset.yaml:20` |
| Nuvem (proposto Fase 3) | RDS, provisionado por `repo-db-infra` (`modules/rds`) | PostgreSQL 16 (decidido, não aplicado) | ADR-0004 e RFC de banco (PR #172, branch `docs/database-justification-pg16`); nenhum `terraform apply` executado até o momento |

Existe uma divergência ativa: dev local e o `StatefulSet` do Kubernetes local
ainda estão em Postgres 15, enquanto o CI já roda 16 e a decisão definitiva
para produção (RDS) também é 16. A correção já foi feita na branch não
mesclada `docs/database-justification-pg16` (PR #172), mas não está
aplicada nesta branch.

## Diagrama ER

Gerado a partir do `prisma/schema.prisma` real (17 models, 3 enums), não de
um rascunho manual. Mostra apenas colunas de identidade (PK/FK/UK); o
detalhamento completo de colunas está na seção
[Modelo relacional](#modelo-relacional).

```mermaid
erDiagram
    USER {
        string id PK
        string email UK
        string role
    }

    CLIENTE {
        string id PK
        string documento UK
        string email UK
        string tipo_documento "enum TaxIdType"
    }

    VEICULO {
        string id PK
        string placa UK
        string id_cliente FK
    }

    ORDEM_SERVICO {
        string id PK
        string id_veiculo FK
        string id_cliente FK
        string status "enum SOStatus"
    }

    ORCAMENTO {
        string id PK
        string id_ordem_servico "FK, UK"
        string status "enum EstimateStatus"
    }

    PECA {
        string id PK
        string codigo UK
    }

    SERVICO {
        string id PK
    }

    OS_PECA {
        string id PK
        string id_ordem_servico FK
        string id_peca FK
    }

    OS_SERVICO {
        string id PK
        string id_ordem_servico FK
        string id_servico FK
    }

    PEDIDO_FORNECEDOR {
        string id PK
        string fornecedor_id "sem FK declarada, sem model Fornecedor"
    }

    PEDIDO_FORNECEDOR_ITEM {
        string id PK
        string id_pedido_fornecedor FK
        string id_peca FK
    }

    RESERVA_ESTOQUE {
        string id PK
        string ordem_id "sem FK declarada"
        string peca_id "sem FK declarada"
    }

    PAGAMENTO {
        string id PK
        string ordemServicoId "sem FK declarada"
    }

    HISTORICO_STATUS_OS {
        string id PK
        string ordem_servico_id FK
        string status_novo "enum SOStatus"
    }

    CLIENTE ||--o{ VEICULO : "1 cliente tem N veiculos"
    CLIENTE ||--o{ ORDEM_SERVICO : "1 cliente abre N OS"
    VEICULO ||--o{ ORDEM_SERVICO : "1 veiculo tem N OS"
    ORDEM_SERVICO ||--o| ORCAMENTO : "1 OS tem 0..1 orcamento"
    ORDEM_SERVICO ||--o{ OS_PECA : "1 OS tem N itens de peca"
    ORDEM_SERVICO ||--o{ OS_SERVICO : "1 OS tem N itens de servico"
    ORDEM_SERVICO ||--o{ HISTORICO_STATUS_OS : "1 OS tem N eventos de status"
    PECA ||--o{ OS_PECA : "1 peca aparece em N itens"
    SERVICO ||--o{ OS_SERVICO : "1 servico aparece em N itens"
    PECA ||--o{ PEDIDO_FORNECEDOR_ITEM : "1 peca aparece em N itens de pedido"
    PEDIDO_FORNECEDOR ||--o{ PEDIDO_FORNECEDOR_ITEM : "1 pedido tem N itens"
```

Três entidades ficam fora das linhas de relacionamento do diagrama porque o
schema não declara `@relation` nelas, mesmo guardando um ID de outra
entidade:

- `PedidoFornecedor.fornecedor_id`: não existe model `Fornecedor` no schema.
  O fornecedor é só uma string solta, sem integridade referencial no banco.
- `ReservaEstoque.ordem_id` e `ReservaEstoque.peca_id`: apontam
  conceitualmente para `OrdemServico` e `Peca`, mas sem `@relation` nem FK
  real no Postgres.
- `Pagamento.ordemServicoId`: mesma situação, aponta para `OrdemServico`
  sem FK declarada.

`User` também fica isolado no diagrama: é a entidade de autenticação, sem
nenhum relacionamento com o domínio de negócio.

### Enums

- `TaxIdType`: `CPF`, `CNPJ`.
- `SOStatus`: `RECEIVED`, `UNDER_DIAGNOSIS`, `AWAITING_APPROVAL`,
  `IN_PROGRESS`, `AWAITING_PARTS`, `FINISHED`, `DELIVERED`,
  `CLOSED_WITHOUT_EXECUTION`.
- `EstimateStatus`: `PENDING`, `APPROVED`, `REJECTED`.

## Modelo relacional

Todas as PKs seguem o mesmo padrão: coluna `id`, tipo `text` (não é o tipo
nativo `uuid` do Postgres), valor gerado pelo Prisma Client via
`@default(uuid())`, não por um `DEFAULT` do próprio banco. Isso não é
repetido tabela por tabela abaixo.

### `User`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| email | text | UNIQUE, not null |
| password | text | not null |
| name | text | not null |
| role | text | not null, default `"admin"` |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

Sem relacionamento com nenhuma outra tabela. É a entidade de autenticação
local (papéis `ADMIN`, `RECEPCIONISTA`, `MECANICO` aplicados via `role`).

### `Cliente`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| nome | text | not null |
| email | text | UNIQUE, not null |
| telefone | text | nullable |
| documento | text | UNIQUE, not null |
| tipo_documento | `TaxIdType` (enum) | not null |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

### `Veiculo`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| placa | text | UNIQUE, not null |
| marca | text | not null |
| modelo | text | not null |
| ano | integer | not null |
| cor | text | nullable |
| id_cliente | text | FK -> `Cliente.id`, `ON DELETE CASCADE`, not null |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

### `OrdemServico`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| id_veiculo | text | FK -> `Veiculo.id`, `ON DELETE CASCADE`, not null |
| id_cliente | text | FK -> `Cliente.id`, `ON DELETE CASCADE`, not null |
| status | `SOStatus` (enum) | not null, default `RECEIVED` |
| descricao | text | nullable |
| iniciada_em | timestamp | nullable |
| finalizada_em | timestamp | nullable |
| entregue_em | timestamp | nullable |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

`id_veiculo` e `id_cliente` são redundantes entre si (todo veículo já
aponta pra um cliente único via `Veiculo.id_cliente`), mas ambos ficam
gravados direto na OS. Isso evita um join extra pra achar o dono da OS e
permite, em tese, uma OS registrar um cliente diferente do dono atual do
veículo (não validado em nenhum lugar do código auditado aqui).

### `Orcamento`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| id_ordem_servico | text | FK -> `OrdemServico.id`, `ON DELETE CASCADE`, UNIQUE, not null |
| valor_total_servicos | numeric(10,2) | not null, default 0 |
| valor_total_pecas | numeric(10,2) | not null, default 0 |
| valor_total_geral | numeric(10,2) | not null, default 0 |
| status | `EstimateStatus` (enum) | not null, default `PENDING` |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

O `UNIQUE` em `id_ordem_servico` é o que torna a relação 1:0..1 com
`OrdemServico` (uma OS tem no máximo um orçamento).

### `Peca`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| nome | text | not null |
| codigo | text | UNIQUE, not null |
| descricao | text | nullable |
| preco | numeric(10,2) | not null |
| quantidade_estoque | integer | not null, default 0 |
| quantidade_minima | integer | not null, default 1 |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

### `Servico`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| nome | text | not null |
| descricao | text | nullable |
| preco | numeric(10,2) | not null |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

### `OsPeca`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| id_ordem_servico | text | FK -> `OrdemServico.id`, `ON DELETE CASCADE`, not null |
| id_peca | text | FK -> `Peca.id`, `ON DELETE RESTRICT`, not null |
| quantidade | integer | not null |
| preco_unitario | numeric(10,2) | not null |
| valor_total | numeric(10,2) | not null |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

`UNIQUE(id_ordem_servico, id_peca)`: uma peça aparece no máximo uma vez por
OS (quantidade é ajustada na mesma linha, não duplicada).
`ON DELETE RESTRICT` em `id_peca` impede apagar uma peça que já foi usada
em alguma OS.

### `OsServico`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| id_ordem_servico | text | FK -> `OrdemServico.id`, `ON DELETE CASCADE`, not null |
| id_servico | text | FK -> `Servico.id`, `ON DELETE RESTRICT`, not null |
| quantidade | integer | not null, default 1 |
| preco_unitario | numeric(10,2) | not null |
| valor_total | numeric(10,2) | not null |
| created_at | timestamp | default now() |
| updated_at | timestamp | auto-update |

Mesmo padrão de `OsPeca`: `UNIQUE(id_ordem_servico, id_servico)` e
`ON DELETE RESTRICT` em `id_servico`.

### `PedidoFornecedor`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| fornecedor_id | text | not null, **sem FK** |
| status | text | not null, default `"PENDENTE"` (valores usados no código: `PENDENTE`, `RECEBIDO`; não é enum do Prisma) |
| criado_em | timestamp | default now() |
| atualizado_em | timestamp | auto-update |

`fornecedor_id` não referencia nenhuma tabela porque não existe model
`Fornecedor` no schema. É um identificador externo solto, sem integridade
referencial garantida pelo banco.

### `PedidoFornecedorItem`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| id_pedido_fornecedor | text | FK -> `PedidoFornecedor.id`, `ON DELETE CASCADE`, not null |
| id_peca | text | FK -> `Peca.id`, `ON DELETE RESTRICT`, not null |
| quantidade_solicitada | integer | not null |
| quantidade_recebida | integer | not null, default 0 |

Única tabela do schema sem `created_at`/`updated_at`.

### `ReservaEstoque`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| ordem_id | text | not null, **sem FK** (aponta conceitualmente pra `OrdemServico.id`) |
| peca_id | text | not null, **sem FK** (aponta conceitualmente pra `Peca.id`) |
| quantidade | integer | not null |
| reservado_em | timestamp | default now() |

`UNIQUE(ordem_id, peca_id)`, mas sem `@relation` em nenhum dos dois campos.
Postgres não impede inserir uma reserva com `ordem_id`/`peca_id` que não
existem em `OrdemServico`/`Peca`.

### `Pagamento` (tabela física: `pagamentos`, via `@@map`)

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| ordemServicoId | text | not null, **sem FK** (aponta conceitualmente pra `OrdemServico.id`) |
| valor | numeric(10,2) | not null |
| status | text | not null (sem enum do Prisma) |
| createdAt | timestamp | default now() |

Única tabela sem `updated_at`, e a única com colunas em camelCase
(`ordemServicoId`, `createdAt`) em vez do `snake_case` usado no resto do
schema.

### `HistoricoStatusOS` (tabela física: `historico_status_os`, via `@@map`)

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| id | text | PK |
| ordem_servico_id | text | FK -> `OrdemServico.id`, `ON DELETE CASCADE`, not null |
| status_anterior | `SOStatus` (enum) | nullable |
| status_novo | `SOStatus` (enum) | not null |
| motivo | text | nullable |
| data_hora | timestamp | default now() |

Log de eventos, imutável por natureza: só tem `data_hora`, sem
`created_at`/`updated_at`.

## Relacionamentos entre tabelas

| Origem (FK) | Coluna | Destino | `ON DELETE` | Cardinalidade |
| --- | --- | --- | --- | --- |
| `Veiculo` | `id_cliente` | `Cliente` | CASCADE | N:1 |
| `OrdemServico` | `id_veiculo` | `Veiculo` | CASCADE | N:1 |
| `OrdemServico` | `id_cliente` | `Cliente` | CASCADE | N:1 |
| `Orcamento` | `id_ordem_servico` | `OrdemServico` | CASCADE | 1:1 (UNIQUE) |
| `OsPeca` | `id_ordem_servico` | `OrdemServico` | CASCADE | N:1 |
| `OsPeca` | `id_peca` | `Peca` | RESTRICT | N:1 |
| `OsServico` | `id_ordem_servico` | `OrdemServico` | CASCADE | N:1 |
| `OsServico` | `id_servico` | `Servico` | RESTRICT | N:1 |
| `PedidoFornecedorItem` | `id_pedido_fornecedor` | `PedidoFornecedor` | CASCADE | N:1 |
| `PedidoFornecedorItem` | `id_peca` | `Peca` | RESTRICT | N:1 |
| `HistoricoStatusOS` | `ordem_servico_id` | `OrdemServico` | CASCADE | N:1 |
| *(sem FK)* `ReservaEstoque` | `ordem_id`, `peca_id` | `OrdemServico`, `Peca` | n/a | N:1, N:1 (não garantido pelo banco) |
| *(sem FK)* `Pagamento` | `ordemServicoId` | `OrdemServico` | n/a | N:1 (não garantido pelo banco) |
| *(sem FK)* `PedidoFornecedor` | `fornecedor_id` | nenhuma tabela (sem model `Fornecedor`) | n/a | n/a |

`ON DELETE CASCADE` domina o schema: apagar um `Cliente` apaga em cascata
seus veículos, OSs, orçamentos, itens de OS e histórico de status.
`ON DELETE RESTRICT` só aparece nas duas tabelas de junção que referenciam
`Peca`/`Servico` (`OsPeca`, `OsServico`, `PedidoFornecedorItem`), impedindo
apagar uma peça ou serviço já usado.

## Mapeamento entre entidades de domínio e tabelas

Comparado com a linguagem ubíqua descrita em [`ddd.md`](../ddd.md) §2-4:

| Termo de domínio (`ddd.md`) | Nome citado no `ddd.md` | Model/tabela real no Prisma | Observação |
| --- | --- | --- | --- |
| Ordem de Serviço | `OrdemDeServico` | `OrdemServico` | Nome diverge: `ddd.md` usa "OrdemDeServico", o schema usa "OrdemServico" |
| Cliente | `Cliente` | `Cliente` | Igual |
| Veículo | `Veiculo` | `Veiculo` | Igual |
| Serviço | `Servico` | `Servico` | Igual |
| Peça/Insumo | `PecaInsumo` | `Peca` | Nome diverge: `ddd.md` usa "PecaInsumo", o schema usa "Peca" |
| Orçamento | `Orcamento` (Value Object da OS, em `ddd.md` §4.1) | `Orcamento` (entidade própria, tabela e FK dedicadas) | `ddd.md` modela como Value Object; a persistência real é uma entidade com identidade própria (`id`, tabela, relação 1:1 com `OrdemServico`) |
| Status da OS | `status` (campo simples) | `OrdemServico.status` (enum) + tabela `historico_status_os` | `ddd.md` não menciona o histórico de status como algo persistido à parte |
| Estoque | `quantidade_estoque` | `Peca.quantidade_estoque` | Igual |

Tabelas sem entrada correspondente na linguagem ubíqua de `ddd.md` (são
tabelas de suporte/junção, não conceitos de negócio nomeados no documento):
`User`, `OsPeca`, `OsServico`, `PedidoFornecedor`, `PedidoFornecedorItem`,
`ReservaEstoque`, `Pagamento`, `HistoricoStatusOS`.

## Convenções observadas (e onde elas quebram)

- **Nomenclatura de tabela**: 15 dos 17 models não usam `@@map`, então a
  tabela física tem o mesmo nome do model, em PascalCase (`Cliente`,
  `OrdemServico`, `OsPeca` etc.) e precisa de aspas duplas no Postgres.
  Só `Pagamento` (-> `pagamentos`) e `HistoricoStatusOS` (->
  `historico_status_os`) usam `@@map` para `snake_case`. Não há
  justificativa registrada em nenhum commit para essa divergência.
- **Nomenclatura de coluna de timestamp**: a maioria usa
  `created_at`/`updated_at` em `snake_case`. Exceções: `PedidoFornecedor`
  usa `criado_em`/`atualizado_em` (português), `Pagamento` usa
  `createdAt` (camelCase) e não tem `updated_at`, e
  `PedidoFornecedorItem`/`ReservaEstoque`/`HistoricoStatusOS` não têm
  `updated_at` nenhum.
- **Enums do Prisma vs. `status` como texto livre**: `SOStatus` e
  `EstimateStatus` são enums reais do Prisma (com constraint no banco). Já
  `PedidoFornecedor.status` e `Pagamento.status` são `text` livre, com os
  valores válidos garantidos só por convenção no código da aplicação, não
  pelo banco.
