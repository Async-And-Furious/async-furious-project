# RFCs — Async & Furious

RFCs registram decisões técnicas (não apenas arquiteturais de alto nível — ver [ADRs](../adr/README.md) para isso) que ainda podem evoluir.

## RFCs

Os quatro PRs que introduziram as RFCs abaixo (#171, #172, #173) já foram
mesclados em 2026-08-23 — os documentos existem localmente nesta pasta.

| Tema | RFC | PR de origem |
|---|---|---|
| API Gateway e integração com EKS | [RFC-003](./RFC-003-api-gateway-eks-integration.md) | [#171](https://github.com/Async-And-Furious/async-furious-project/pull/171) |
| Ownership da VPC | [RFC-004](./RFC-004-vpc-ownership.md) | [#171](https://github.com/Async-And-Furious/async-furious-project/pull/171) |
| Estratégia de segredos e assinatura JWT | [RFC-006](./RFC-006-secrets-and-jwt.md) | [#173](https://github.com/Async-And-Furious/async-furious-project/pull/173) |
| Motor/versão definitivos do banco (PostgreSQL 16 / RDS) | [database-justification](./database-justification.md) | [#172](https://github.com/Async-And-Furious/async-furious-project/pull/172) |
| Acesso público do RDS | [RFC-007](./RFC-007-rds-public-access.md) | — |

- [RFC-007 — Acesso público do RDS](./RFC-007-rds-public-access.md): substitui parcialmente a RFC-004 — o RDS passa a ser acessível publicamente (security group restrito por CIDR), em vez de isolado na VPC do `repo-k8s-infra`, para viabilizar o acesso direto da Lambda de autenticação ao banco (ADR-0005 do `repo-auth-serverless`), já que a `LabRole` da conta AWS Academy não permite permissões de VPC/ENI. Supera o PR [#3](https://github.com/Async-And-Furious/repo-db-infra/pull/3) do `repo-db-infra`.

## Lacuna identificada: `HANDOFF.md`

As RFCs do trigo referenciam repetidamente um arquivo `HANDOFF.md` (ex.:
"HANDOFF.md §20", "§6.1") como lista mestra de decisões da Fase 3.
**`HANDOFF.md` não foi encontrado em nenhuma branch de nenhum dos quatro
repositórios**, nem localmente. `TODO`: localizar ou reconstruir esse
documento.
