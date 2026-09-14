# RFC-004 — Ownership da VPC e outputs

- **Status**: Aceita
- **Data**: 2026-07-29
- **Fonte da verdade**: este arquivo, em `async-furious-project`. Cópias
  existem em `repo-k8s-infra` e `repo-db-infra` para visibilidade local —
  atualizar aqui primeiro, depois sincronizar.

## Contexto

O HANDOFF.md §6.1 sugeriu o `repo-k8s-infra` como dono da VPC, mas deixou
isso sem confirmação. O Tech Challenge Fase 3 exige dois repositórios
Terraform separados — um para a infra de Kubernetes, outro para o banco
gerenciado — e um banco de dados precisa estar dentro de alguma VPC/subnet,
então exatamente um dos dois precisa ser dono da rede.

## Decisão

O `repo-k8s-infra` é dono da VPC, das subnets públicas/privadas e das
tabelas de rota/NAT. O `repo-db-infra` não cria uma VPC; ele consome
`vpc_id` e `private_subnet_ids` como variáveis de input Terraform, vindas
dos outputs do `repo-k8s-infra`.

## Justificativa

- A própria divisão de repositórios do desafio (§3.2) exige dois repos de
  infra independentes; um ser dono da rede é a única forma de evitar duas
  VPCs concorrentes.
- O `variables.tf` do `repo-db-infra` já estava estruturado para receber
  `vpc_id`/`private_subnet_ids` como inputs — esta decisão apenas
  formaliza o desenho existente em vez de mudá-lo.
- Nenhum requisito do desafio restringe o consumo de outputs Terraform
  entre repositórios; cada repo continua sendo dono do seu próprio state
  Terraform, CI/CD e pipeline de apply de forma independente (§3.7).

## Consequências

- O `repo-k8s-infra` expõe `vpc_id`, `private_subnet_ids`,
  `public_subnet_ids`, `cluster_name`, `ecr_repository_url` (conforme
  HANDOFF.md §5.2) para os repositórios consumidores.
- O `repo-db-infra` precisa ser aplicado depois do `repo-k8s-infra` (ordem
  de provisionamento conforme HANDOFF.md §6.4: rede antes do banco).
- Os valores de output são passados via um data source
  `terraform_remote_state` no `repo-db-infra`, apontando para a state key
  S3 do `repo-k8s-infra`
  (`repo-k8s-infra/${environment}/terraform.tfstate`, o mesmo bucket que
  ambos os repositórios usam para seus próprios states). `vpc_id`/
  `private_subnet_ids` ainda aceitam overrides manuais;
  `allowed_security_group_ids` sempre inclui o security group do node
  group do EKS mais quaisquer extras. Isso só se resolve depois que o
  state do `repo-k8s-infra` tiver sido de fato aplicado para aquele
  ambiente — o requisito de ordem de provisionamento acima é estrutural,
  não apenas uma sugestão.
