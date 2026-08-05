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
