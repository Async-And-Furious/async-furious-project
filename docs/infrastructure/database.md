# Banco de Dados

> Decisão de engine/versão registrada em
> [ADR-0004](../adr/0004-banco-dados-gerenciado.md) e
> RFC de banco (trigo). Este
> documento cobre o estado por ambiente.

## Estado por ambiente

| Ambiente | Onde roda | Versão | Evidência |
|---|---|---|---|
| Dev local (`docker compose`) | `docker-compose.dependencies.yml` | `postgres:15-alpine` | `docker-compose.dependencies.yml` |
| CI (`tests.yml`, `zap.yml`) | Serviço containerizado no runner | `postgres:16` | `.github/workflows/tests.yml` |
| Kubernetes local (`kind`) | `StatefulSet` | `postgres:15-alpine` | `k8s/database/statefulset.yaml` |
| **[PROPOSTA FASE 3]** Nuvem | RDS (`repo-db-infra`) | PostgreSQL **16.4** (decidido) | RFC de banco (trigo); **nenhum `terraform apply` executado** |

**Divergência ativa**: dev local e o `StatefulSet` do Kubernetes local ainda
estão em Postgres 15, enquanto CI já roda 16 e a decisão definitiva (RDS) é
16. A correção (`docker-compose.dependencies.yml` → `postgres:16-alpine`)
já foi feita na branch não mesclada `docs/database-justification-pg16`, mas
**não está aplicada nesta branch**.

## Modelo de dados (via Prisma)

Ver `docs/contexto-tecnico-consolidado.md` §6 (tabela entidade de
domínio ↔ tabela Prisma) e `prisma/schema.prisma` para o mapeamento
completo. Não duplicado aqui para evitar divergência entre fontes —
`prisma/schema.prisma` é sempre a fonte de verdade.

## [PROPOSTA FASE 3] RDS — configuração decidida

- `engine = "postgres"`, `engine_version = "16.4"`,
  `auto_minor_version_upgrade = true`.
- Homologação: `multi_az = false`, `skip_final_snapshot = true`, retenção de
  backup de 1 dia (ambiente descartável).
- Produção: `multi_az = true`, `deletion_protection = true`, retenção de
  backup de 7 dias.
- Senha mestra: `manage_master_user_password = true` — gerada e armazenada
  pela própria RDS no Secrets Manager, nunca em Terraform state.
- Rede: `repo-db-infra` **não cria VPC própria** — consome `vpc_id` e
  `private_subnet_ids` de `repo-k8s-infra` via
  `terraform_remote_state` (RFC-004 (trigo)).
  Ordem de provisionamento obrigatória: `repo-k8s-infra` antes de
  `repo-db-infra`.

## Pendências

- `TODO`: como a Lambda `authenticate-customer` (e, futuramente, a própria
  aplicação) autentica para ler a senha mestra gerada pela RDS no Secrets
  Manager — mecanismo (IAM role vs. referência estática de ARN) deixado em
  aberto na própria RFC-006 (trigo).
- `TODO`: índices, constraints de unicidade (`documento` do Cliente,
  `placa` do Veículo) e estratégia de soft-delete não estão documentados em
  nenhuma fonte — apenas o `schema.prisma` real teria essa resposta, não
  auditado campo a campo nesta tarefa.
