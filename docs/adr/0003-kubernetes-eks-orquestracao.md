# ADR-0003: Kubernetes/EKS como plataforma de orquestração

## Status

Aceita

## Contexto

Segundo o `README.md`, "com o aumento da demanda e a expansão para novas
unidades, a oficina precisa garantir alta disponibilidade do sistema mesmo em
picos de atendimento" — motivação de negócio explícita para escalabilidade
horizontal automática. Nenhuma alternativa descartada (ECS/Fargate,
serverless puro) está documentada com um comparativo formal; a decisão por
Kubernetes aparece já tomada tanto no spec de infraestrutura quanto na
criação de `repo-k8s-infra`.

## Decisão

Adotar Kubernetes como plataforma de orquestração, em dois estágios:

1. **Local/CI** [ATUAL, implementado]: cluster `kind` (Kubernetes-in-Docker),
   provisionado via Terraform (`infra/modules/kind-cluster`), com HPA de 2 a
   5 réplicas (CPU > 70% ou memória > 80%), documentado e aprovado em
   `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`
   (Status: Approved).
2. **Nuvem** [PROPOSTA FASE 3, esqueleto]: Amazon EKS via `repo-k8s-infra`
   (`modules/eks`, `modules/vpc`, `modules/ecr`), com o mesmo conjunto de
   manifests YAML de `/k8s` reaproveitado sem alterações (estrutura modular
   do Terraform escolhida deliberadamente para isso).

## Alternativas consideradas

Registradas em `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`:

- **Manifests via Helm/Kustomize**: rejeitado em favor de YAML puro em
  `/k8s`, por legibilidade e depuração direta via `kubectl`.
- **Terraform com backend de state remoto desde o início**: rejeitado para o
  ambiente local (`.tfstate` local, projeto acadêmico, sem necessidade de
  backend remoto ainda).
- **ECS/Fargate ou serverless puro para a aplicação**: não há registro de
  avaliação formal — apenas o Kubernetes foi levado adiante.

## Consequências positivas

- HPA já funcional localmente (2-5 réplicas, métricas via `metrics-server`
  instalado automaticamente pelo módulo `kubernetes-apps`).
- Estrutura Terraform modular permite que a migração para EKS seja apenas um
  novo diretório de ambiente (`infra/environments/aws`), sem reescrever os
  manifests `/k8s`.
- CI/CD já valida a infraestrutura local a cada PR e a exercita de ponta a
  ponta (`terraform apply` + smoke test + `terraform destroy`) em cada push
  para `main`/`develop`, contra um cluster efêmero — sem custos de nuvem.

## Consequências negativas

- Dois caminhos de infraestrutura (local `kind` neste repositório e EKS em
  `repo-k8s-infra`) precisam ser mantidos consistentes manualmente até que a
  migração seja concluída.
- `repo-k8s-infra` está em estágio de esqueleto — nenhum `terraform apply`
  foi executado; o caminho EKS descrito aqui é uma decisão, não uma
  implantação real.

## Riscos

- **Médio**: `infra/environments/aws/README.md` (neste repositório) já era
  descrito como "stub — not implemented" antes mesmo da criação de
  `repo-k8s-infra` — há dois lugares descrevendo a mesma migração futura
  (este repositório e o novo repositório dedicado); `TODO` confirmar qual é
  a fonte de verdade daqui para frente.
- **Baixo**: nenhuma politica de rede (NetworkPolicy) ou hardening adicional
  de cluster foi encontrada em nenhum dos dois caminhos.

## Referências

- `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`
- [Diagrama de Deployment](../architecture/deployment-diagram.md)
- [`docs/infrastructure/kubernetes.md`](../infrastructure/kubernetes.md)
- `infra/environments/aws/README.md` (este repositório)
- README de `repo-k8s-infra` (consultado via `gh api`)
