# ADR-0001: Separação da solução em quatro repositórios

## Status

Aceita

## Contexto

A solução era um único repositório (`async-furious-project`), monólito
NestJS contendo os quatro Bounded Contexts de negócio e a autenticação. Para
a Fase 3, o Tech Challenge exige uma arquitetura distribuída com
autenticação centralizada via API Gateway/Function Serverless, cluster
Kubernetes e banco de dados gerenciado. Cada uma dessas responsabilidades de
infraestrutura tem ciclo de vida, ferramentas (Terraform vs. NestJS/Prisma) e
cadência de mudança diferentes do código de negócio.

## Decisão

Dividir a solução em quatro repositórios independentes na organização
GitHub `Async-And-Furious`:

1. **`async-furious-project`** (referenciado como `repo-application` nas
   RFCs) — o monólito NestJS com os quatro Bounded Contexts de negócio
   (`cadastro`, `ordem-servico`, `pecas-insumos`, `financeiro`) e o módulo de
   autenticação local hoje existente.
2. **`repo-auth-serverless`** — autenticação centralizada (CPF, emissão e
   validação de JWT) via API Gateway + Functions Serverless.
3. **`repo-k8s-infra`** — provisionamento de VPC e cluster Kubernetes (EKS)
   via Terraform.
4. **`repo-db-infra`** — provisionamento do banco de dados gerenciado (RDS)
   via Terraform.

Cada repositório mantém seu próprio pipeline de CI/CD e estado Terraform
(quando aplicável), evitando um único ponto de acoplamento de deploy.

## Alternativas consideradas

Nenhuma alternativa (ex.: monorepo único com pastas separadas, ou divisão em
número diferente de repositórios) está documentada em nenhuma RFC/ADR
encontrada. `TODO`: o racional completo desta decisão provavelmente está em
`HANDOFF.md`, que não foi localizado (ver [`docs/rfcs/README.md`](../rfcs/README.md)).
A única alternativa mencionada é implícita: manter tudo no monólito, o que a
RFC-004 do trigo (em revisão — ver [Referências](#referências)) trata como já
descartada ("a divisão do desafio... exige dois repos de infra
independentes").

## Consequências positivas

- Ciclo de vida e permissões de infraestrutura (Terraform/AWS) isolados do
  código de aplicação (NestJS/Prisma).
- Cada repositório de infraestrutura pode ser aplicado, revisado e testado
  independentemente (`ci.yml` próprio em cada um).
- `repo-k8s-infra` expõe outputs (`vpc_id`, `private_subnet_ids`, etc.) que
  `repo-db-infra` consome via `terraform_remote_state`, evitando VPCs
  concorrentes (RFC-004 do trigo).

## Consequências negativas

- Coordenação entre repositórios exige ordem de provisionamento explícita
  (rede antes de banco, por exemplo) e outputs versionados corretamente.
- Decisões que afetam mais de um repositório (ex.: RFC-003, RFC-004)
  precisam manter cópias sincronizadas manualmente — os próprios arquivos
  de RFC dizem "update here first, then sync", um processo manual sem
  automação confirmada.
- Nenhum dos três repositórios satélite tem `terraform apply` executado até
  o momento desta auditoria — a divisão existe estruturalmente, mas a
  infraestrutura real ainda não roda em nenhum deles.

## Riscos

- **Alto**: `HANDOFF.md`, citado como fonte de decisões cross-repo, não foi
  localizado — decisões futuras que dependam dele não podem ser totalmente
  auditadas.
- **Médio**: processo manual de sincronização de cópias de RFC entre
  repositórios pode divergir silenciosamente.
- **Baixo**: nomeação de branch `homolog` nos três repositórios satélite
  diverge de `develop`, usado em `async-furious-project` — inconsistência
  de convenção, não de arquitetura.

## Referências

- RFC-003 (API Gateway/EKS) e RFC-004 (ownership da VPC), do trigo — em
  revisão, não duplicadas nesta branch: ver [`docs/rfcs/README.md`](../rfcs/README.md)
- READMEs de `repo-auth-serverless`, `repo-k8s-infra`, `repo-db-infra`
  (consultados via `gh api`, não versionados neste repositório)
- [Visão geral da arquitetura](../architecture/overview.md)
