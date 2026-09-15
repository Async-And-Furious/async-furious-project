# ADR-0004: Banco de dados gerenciado (Amazon RDS PostgreSQL)

## Status

Aceita — decisão detalhada na RFC de banco do trigo
([justificativa](../rfcs/database-justification.md), mesclada via PR
[#172](https://github.com/Async-And-Furious/async-furious-project/pull/172)).
**Não aplicada em infraestrutura real** (skeleton apenas em
`repo-db-infra`).

> **Nota (2026-08-21):** a topologia de rede aqui descrita (RDS dentro da
> VPC do EKS, ver RFC-004) foi superada pela
> [RFC-007](../rfcs/RFC-007-rds-public-access.md) — o RDS passa a ser
> publicamente acessível (security group restrito por CIDR), para viabilizar
> o acesso direto da Lambda de autenticação via CPF, dado que a `LabRole` da
> conta AWS Academy não permite permissões de VPC/ENI. Engine/versão
> (PostgreSQL 16) não são afetados por essa mudança.
>
> **Nota (2026-09-15):** a RFC-007 foi superada e o RDS voltou a ser privado
> nos dois ambientes, com a Lambda de autenticação dentro da VPC. A
> justificativa acima cita a `LabRole` de uma conta AWS Academy, mas os
> ambientes rodam em uma conta AWS pessoal, no free tier. Ver
> [aws.md](../infrastructure/aws.md#10-conta-aws).


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
  repositório) já foi atualizado para `postgres:16-alpine` (PR #172,
  mesclado). O `StatefulSet` do Kubernetes local
  (`k8s/database/statefulset.yaml`) ainda está em `postgres:15-alpine` —
  divergência residual não coberta por aquele PR.
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
  `postgres:16-alpine` já foi mesclada (PR #172), mas o `StatefulSet` do
  Kubernetes local continua em `postgres:15-alpine` — a divergência
  dev/CI/prod persiste parcialmente até esse ponto ser corrigido.

## Referências

- RFC de banco (trigo) — ver [`docs/rfcs/README.md`](../rfcs/README.md)
- `prisma/schema.prisma`
- [`docs/infrastructure/database.md`](../infrastructure/database.md)
- README de `repo-db-infra` (consultado via `gh api`)
