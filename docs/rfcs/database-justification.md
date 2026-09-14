# Justificativa formal do banco de dados

- **Status**: Aceita
- **Data**: 2026-07-29
- **Resolve**: HANDOFF.md §20, decisão #6 ("Banco definitivo e versão")
  (referência histórica a um documento de planejamento — HANDOFF.md — não
  encontrado nos repositórios; ver [`docs/rfcs/README.md`](./README.md))
- **Fonte da verdade**: este arquivo, em `async-furious-project`. Cópia
  existe em `repo-db-infra` para visibilidade local — atualizar aqui
  primeiro, depois sincronizar.

## Decisão

**Amazon RDS for PostgreSQL 16**, provisionado via `repo-db-infra`
(`modules/rds`).

## Contexto

O engine nunca esteve de fato em aberto — a aplicação já usa PostgreSQL
exclusivamente via Prisma (`datasource db { provider = "postgresql" }` em
`async-furious-project/prisma/schema.prisma`). A única lacuna real era um
descompasso de **versão** não resolvido entre os ambientes:

- CI (`tests.yml`, `zap.yml`): `postgres:16`
- Dev local (`docker-compose.dependencies.yml`): `postgres:15-alpine`
- RDS: indefinido

## Justificativa

- Trocar de engine (por exemplo, para MySQL) significaria reescrever o
  schema Prisma, todas as migrations, e revalidar toda a lógica de negócio
  existente contra um dialeto SQL diferente — não há justificativa para
  esse custo.
- PostgreSQL 16 já era o alvo do CI; alinhar o dev local e o RDS a essa
  versão remove um bug latente em que código poderia passar localmente
  contra a versão 15 e se comportar de forma diferente em CI/prod contra a
  versão 16 (disponibilidade de extensões, comportamento do planner,
  sintaxe depreciada).
- RDS PostgreSQL é um engine totalmente gerenciado na AWS, atendendo
  diretamente o requisito de "banco gerenciado" (§3.1/§3.4), com backups
  automatizados nativos, criptografia em repouso e failover Multi-AZ para
  produção.

## Consequências

- O `docker-compose.dependencies.yml` foi atualizado para
  `postgres:16-alpine`, alinhando com CI e RDS.
- O `repo-db-infra/modules/rds` provisiona um `aws_db_instance` com
  `engine = "postgres"`, `engine_version = "16.4"`,
  `auto_minor_version_upgrade = true` (versões de patch podem variar
  automaticamente; a versão major 16 é fixada).
- hml: `multi_az = false`, `skip_final_snapshot = true`, retenção de
  backup de 1 dia (barato, descartável).
- prod: `multi_az = true`, `deletion_protection = true`, retenção de
  backup de 7 dias.
- A senha master usa o master user password gerenciado pelo RDS
  (`manage_master_user_password = true`): a AWS gera e armazena a senha
  diretamente no Secrets Manager, nunca no state do Terraform ou em um
  secret de CI. O cliente de banco da Lambda lê essa senha do Secrets
  Manager em runtime — como ela se autentica para buscar esse secret (IAM
  role vs. referência estática por ARN) já foi definido na RFC-006
  (estratégia de secrets), que está aceita.
