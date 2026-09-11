# ADR-0004: Banco de dados gerenciado (Amazon RDS PostgreSQL)

# ADR-0004: Banco de dados gerenciado (Amazon RDS PostgreSQL)

## Status

Aceita e implementada. A RFC de banco ([`database-justification.md`](../rfcs/database-justification.md)) foi mesclada em 2026-08-23 (PR [#172](https://github.com/Async-And-Furious/async-furious-project/pull/172)), o RDS foi efetivamente provisionado em `repo-db-infra` (`modules/rds`), e `docker-compose.dependencies.yml` já usa `postgres:16-alpine`, alinhado ao CI (`postgres:16`).

> **Nota (2026-08-21):** a topologia de rede aqui descrita (RDS dentro da
> VPC do EKS, ver RFC-004) foi superada pela
> [RFC-007](../rfcs/RFC-007-rds-public-access.md) — o RDS passa a ser
> publicamente acessível (security group restrito por CIDR), para viabilizar
> o acesso direto da Lambda de autenticação via CPF, dado que a `LabRole` da
> conta AWS Academy não permite permissões de VPC/ENI. Engine/versão
> (PostgreSQL 16) não são afetados por essa mudança.


## Contexto

A Fase 3 exige um "banco de dados gerenciado". A aplicação já usa
PostgreSQL exclusivamente via Prisma (`prisma/schema.prisma`,
`provider = "postgresql"`) — trocar de engine (ex.: para MySQL) exigiria
reescrever schema, migrations e revalidar toda a lógica de negócio contra
outro dialeto SQL, sem nenhuma justificativa para esse custo. O único ponto
realmente em aberto era a **versão**, que divergia entre ambientes: CI usava
`postgres:16` (`.github/workflows/tests.yml`), dev local usava
`postgres:15-alpine` (`docker-compose.dependencies.yml`), e RDS estava
indefinido.

## Decisão

**Amazon RDS for PostgreSQL 16**, provisionado por `repo-db-infra`
(`modules/rds`):

- `engine_version = "16.4"`, `auto_minor_version_upgrade = true` (major
  version 16 fixado; patches liberados automaticamente).
- Homologação: `multi_az = false`, `skip_final_snapshot = true`, retenção de
  backup de 1 dia.
- Produção: `multi_az = true`, `deletion_protection = true`, retenção de
  backup de 7 dias.
- Senha mestra gerenciada pela própria RDS
  (`manage_master_user_password = true`) — a AWS gera e guarda a senha no
  Secrets Manager diretamente; nunca aparece em state do Terraform ou em
  secret de CI.

## Alternativas consideradas

(Registradas na RFC de banco)

- **Trocar de engine (ex.: MySQL)**: rejeitado — custo de reescrita de
  schema/migrations sem benefício, e o engine nunca esteve realmente em
  aberto (Prisma já usa PostgreSQL desde o início do projeto).
- **Manter PostgreSQL 15 em produção**: rejeitado — CI já usava 16;
  divergência de versão entre CI e prod cria risco de bug latente (comportamento
  de planner, sintaxe depreciada, disponibilidade de extensões).

## Consequências positivas

- Elimina divergência de versão entre dev local, CI e produção.
- Satisfaz o requisito de "banco gerenciado" (backups automáticos,
  criptografia em repouso, failover Multi-AZ em produção) sem operação
  manual de banco.
- Senha mestra nunca transita por Terraform state nem por secret de CI.

## Consequências negativas

- Nenhuma pendente — `docker-compose.dependencies.yml` já está em
  `postgres:16-alpine`, alinhado ao RDS e ao CI.
- Como a senha é gerenciada inteiramente pela RDS, o mecanismo exato pelo
  qual a Lambda `authenticate-customer` a lê em runtime (IAM role vs.
  referência estática de ARN) foi resolvido pela RFC-006 (Secrets Manager,
  ver `repo-auth-serverless/src/lib/customer-repository.ts`).

## Riscos

- Nenhum pendente relacionado a esta decisão. O RDS está provisionado e em
  uso em HML e produção (confirmado via smoke test de autenticação — ver
  [`docs/reports/integracao-api-gateway-auth-serverless.md`](../reports/integracao-api-gateway-auth-serverless.md)).

## Referências

- RFC de banco — [`database-justification.md`](../rfcs/database-justification.md)
- `prisma/schema.prisma`
- [`docs/infrastructure/database.md`](../infrastructure/database.md)
- README de `repo-db-infra`

