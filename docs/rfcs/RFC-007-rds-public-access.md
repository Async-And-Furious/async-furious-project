# RFC-007 — Acesso público do RDS (substitui parcialmente a RFC-004)

- **Status**: Proposta
- **Data**: 2026-08-21
- **Fonte da verdade**: este arquivo, em `async-furious-project`. Cópia deve
  existir em `repo-db-infra` para visibilidade local — atualizar aqui
  primeiro, depois sincronizar.

## Contexto

A RFC-004 (PR [#171](https://github.com/Async-And-Furious/async-furious-project/pull/171))
decidiu que o RDS ficaria dentro da VPC do `repo-k8s-infra`, acessível
apenas pelos node groups do EKS via security group.

A ADR-0005 do `repo-auth-serverless` (autenticação via CPF) exige que a
Lambda de autenticação consulte o `Cliente` diretamente no Postgres. Isso
só é viável se a Lambda tiver acesso de rede ao RDS. Na conta AWS
Academy/Lab usada neste projeto, a role padrão do laboratório (`LabRole`)
**não pode ser configurada com permissões de VPC/ENI**
(`ec2:CreateNetworkInterface`, `DescribeNetworkInterfaces`,
`DeleteNetworkInterface`) — não é possível anexar policies novas a essa
role. Sem essas permissões, a Lambda não pode ser executada dentro de uma
VPC, o que torna inviável o desenho da RFC-004 para o caso de uso da
autenticação via CPF.

## Decisão

O RDS passa a ser **publicamente acessível**, protegido por um security
group cujo ingress na porta 5432 é restrito a uma lista explícita de
`allowed_cidr_blocks` (nunca `0.0.0.0/0`), em vez de ficar isolado dentro
da VPC do `repo-k8s-infra`.

Isso **substitui** a parte da RFC-004 que amarrava o RDS à VPC do EKS via
`terraform_remote_state`. O `repo-db-infra` deixa de depender do state do
`repo-k8s-infra` para provisionar o banco.

## Justificativa

- É a única forma de viabilizar o acesso direto da Lambda de autenticação
  ao RDS (ADR-0005 do `repo-auth-serverless`), dado que a conta de
  laboratório não permite anexar permissões de rede à `LabRole`.
- Mantém o principal controle de segurança disponível no contexto
  (security group com CIDR restrito), mesmo sem isolamento de rede via VPC.
- Evita reintroduzir a alternativa descartada na ADR-0005 (Lambda chamar um
  endpoint HTTP interno da aplicação em vez do banco direto), que acoplaria
  a disponibilidade do login à disponibilidade do cluster Kubernetes.

## Trade-offs aceitos

- RDS exposto com endpoint público é uma prática **não recomendada em
  produção real** — aceita apenas neste contexto educacional (conta AWS
  Academy/Lab), pela limitação documentada de IAM.
- O EKS (aplicação principal) também precisa se conectar ao RDS por fora da
  VPC agora, via CIDR liberado, em vez de via security group interno.
- `repo-db-infra` não consome mais outputs do `repo-k8s-infra` via
  `terraform_remote_state` — os dois repositórios ficam menos acoplados,
  mas a rede deixa de ser compartilhada.

## Consequências

- O PR [#3](https://github.com/Async-And-Furious/repo-db-infra/pull/3)
  (`feat/rds-module-postgres16`), que implementa o módulo RDS seguindo a
  RFC-004 (RDS dentro da VPC), fica superado por esta decisão e deve ser
  fechado ou reescrito.
- Um novo PR no `repo-db-infra` implementa o módulo RDS com
  `publicly_accessible = true` e `allowed_cidr_blocks` como variável,
  referenciando esta RFC.
- A versão do engine (Postgres 16, conforme PR
  [#172](https://github.com/Async-And-Furious/async-furious-project/pull/172))
  continua válida e não é afetada por esta RFC — apenas a topologia de rede
  muda.

## Alternativas consideradas

- **Manter RDS na VPC (RFC-004 original)**: rejeitada porque a Lambda de
  autenticação não conseguiria alcançar o banco sem permissões de VPC/ENI,
  que a `LabRole` não permite conceder.
- **Lambda chamar endpoint HTTP interno da aplicação**: já avaliada e
  rejeitada na ADR-0005 do `repo-auth-serverless`, por acoplar a
  disponibilidade do login à do cluster.

## Referências

- RFC-004 — Ownership da VPC ([PR #171](https://github.com/Async-And-Furious/async-furious-project/pull/171))
- ADR-0005 (`repo-auth-serverless`) — Acesso da Lambda à base de dados
- ADR-0002 (`repo-auth-serverless`) — Uso da AWS/limitações da conta acadêmica
