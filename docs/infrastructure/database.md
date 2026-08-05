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
