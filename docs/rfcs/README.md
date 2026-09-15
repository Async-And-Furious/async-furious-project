# RFCs — Async & Furious

RFCs registram decisões técnicas (não apenas arquiteturais de alto nível — ver [ADRs](../adr/README.md) para isso) que ainda podem evoluir.

## RFCs do trigo (já mescladas)

O trigo escreveu quatro RFCs para os temas de API Gateway, ownership de
VPC, segredos/JWT e versão do banco de dados. Os PRs abaixo já foram
mesclados e os arquivos existem de verdade em `docs/rfcs/` nesta pasta:

| Tema | PR | Branch de origem | Status (no GitHub) |
|---|---|---|---|
| API Gateway e integração com EKS ([RFC-003](./RFC-003-api-gateway-eks-integration.md)) + Ownership da VPC ([RFC-004](./RFC-004-vpc-ownership.md)) | [#171](https://github.com/Async-And-Furious/async-furious-project/pull/171) | `docs/rfc-003-004-gateway-vpc-ownership` | Merged |
| Motor/versão definitivos do banco (PostgreSQL 16 / RDS) ([justificativa](./database-justification.md)) | [#172](https://github.com/Async-And-Furious/async-furious-project/pull/172) | `docs/database-justification-pg16` | Merged |
| Estratégia de segredos e assinatura JWT ([RFC-006](./RFC-006-secrets-and-jwt.md)) | [#173](https://github.com/Async-And-Furious/async-furious-project/pull/173) | `docs/rfc-006-secrets-jwt` | Merged |

## Nossas RFCs

- [RFC-007 — Acesso público do RDS](./RFC-007-rds-public-access.md): substitui parcialmente a RFC-004 (#171), o RDS passa a ser acessível publicamente (security group restrito por CIDR), em vez de isolado na VPC do `repo-k8s-infra`, para viabilizar o acesso direto da Lambda de autenticação ao banco (ADR-0005 do `repo-auth-serverless`), já que a `LabRole` da conta AWS Academy não permite permissões de VPC/ENI. Supera o PR [#3](https://github.com/Async-And-Furious/repo-db-infra/pull/3) do `repo-db-infra` (fechado sem merge em 23/08/2026).
- [RFC-008 — Escolha do cloud provider (AWS)](./RFC-008-cloud-provider.md): justificativa retroativa para AWS/AWS Academy como provedor único, escrita para a issue [#180](https://github.com/Async-And-Furious/async-furious-project/issues/180). Não houve comparação técnica formal contra GCP/Azure, a conta acadêmica pronta e sem custo foi o fator decisivo.
- [RFC-009 — Escolha da ferramenta de observabilidade (New Relic)](./RFC-009-observability.md): fecha a lacuna que a própria ADR-0005 registra (nenhuma comparação formal contra CloudWatch/Prometheus-Grafana/Datadog). Com dado real de free tier, mostra por que Datadog (sem log/APM grátis) e CloudWatch (múltiplas peças + permissões de IAM sob a `LabRole`) não avançaram.

## Lacuna identificada: `HANDOFF.md`

As RFCs do trigo referenciam repetidamente um arquivo `HANDOFF.md` (ex.:
"HANDOFF.md §20", "§6.1") como lista mestra de decisões da Fase 3.
**`HANDOFF.md` não foi encontrado em nenhuma branch de nenhum dos quatro
repositórios**, nem localmente. `TODO`: localizar ou reconstruir esse
documento.
