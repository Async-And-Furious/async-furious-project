# ADR-0004: Banco de dados gerenciado (Amazon RDS PostgreSQL)

## Status

Proposta — decisão detalhada na RFC de banco do trigo, ainda em PR aberto,
não mesclado (ver [`docs/rfcs/README.md`](../rfcs/README.md)). **Não
aplicada em infraestrutura real** (skeleton apenas em `repo-db-infra`).

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

(Registradas na RFC de banco do trigo)

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

- `docker-compose.dependencies.yml` (ambiente de desenvolvimento local deste
  repositório) ainda está em `postgres:15-alpine` — a atualização para 16
  está decidida mas **não aplicada nesta branch** (existe apenas na branch
  não mesclada `docs/database-justification-pg16`).
- Como a senha é gerenciada inteiramente pela RDS, o mecanismo exato pelo
  qual a Lambda `authenticate-customer` a lê em runtime (IAM role vs.
  referência estática de ARN) foi propositalmente deixado para a RFC-006 do
  trigo — que resolve apenas a parte de JWT/segredos de autenticação, não a
  leitura de credenciais do banco pela própria aplicação.

## Riscos

- **Médio**: nenhum `terraform apply` foi executado em `repo-db-infra` até
  o momento desta auditoria — a decisão de engine/versão está tomada, mas o
  banco gerenciado real ainda não existe.
- **Médio**: a atualização de `docker-compose.dependencies.yml` para
  `postgres:16-alpine` está numa branch não mesclada — risco de a
  divergência dev/CI/prod persistir até o merge acontecer.

## Referências

- RFC de banco (trigo) — ver [`docs/rfcs/README.md`](../rfcs/README.md)
- `prisma/schema.prisma`
- [`docs/infrastructure/database.md`](../infrastructure/database.md)
- README de `repo-db-infra` (consultado via `gh api`)
