# ADR-0015: Gestão de segredos no Kubernetes local via `templatefile()`

## Status

Aceita

## Contexto

O `Secret` do Kubernetes local (`k8s/config/secret.yaml`) precisa conter
`JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `SEED_ADMIN_EMAIL` e
`SEED_ADMIN_PASSWORD`. Hardcodear esses valores no YAML versionado
exporia segredos no histórico do Git — inaceitável mesmo em ambiente
acadêmico/local. Esta é uma decisão de gestão de segredos própria da
Fase 2 (infraestrutura Kubernetes local), distinta da estratégia de
segredos da Fase 3 para autenticação serverless
([RFC-006](../rfcs/README.md), sobre chaves RS256 em Secrets
Manager/SSM).

## Decisão

Valores sensíveis não são escritos diretamente no YAML. O módulo Terraform
`kubernetes-apps` (`infra/modules/kubernetes-apps/`) usa `templatefile()`
para injetar os valores no `Secret` a partir de variáveis Terraform
(`TF_VAR_jwt_secret`, `TF_VAR_db_password`, `TF_VAR_seed_admin_email`,
`TF_VAR_seed_admin_password`), passadas via variáveis de ambiente do shell
(ou `.env.local`, não commitado) na hora do `terraform apply` — nunca
commitadas em `terraform.tfvars` (que é versionado, mas só contém valores
não sensíveis como `cluster_name`, `app_replicas`).

## Alternativas consideradas

- **Hardcodear no YAML**: descartada — exporia segredos no Git.
- **Sealed Secrets / External Secrets Operator**: não avaliada — nenhuma
  evidência de discussão; provavelmente fora de escopo para um cluster
  `kind` local descartável.
- **Backend remoto de secrets (Vault, AWS Secrets Manager) já na Fase 2**:
  não adotada — reservada para a proposta Fase 3
  ([RFC-006](../rfcs/README.md)), que já usa Secrets Manager/SSM para as
  chaves de assinatura JWT do fluxo serverless.

## Consequências positivas

- Nenhum segredo real aparece no histórico do Git — `k8s/config/secret.yaml`
  contém apenas placeholders/templates, não valores.
- `terraform.tfvars` (committed) fica seguro por conter só valores não
  sensíveis; os sensíveis vivem só na variável de ambiente do executor.

## Consequências negativas

- Depende de disciplina do desenvolvedor para nunca commitar `.env.local`
  ou exportar `TF_VAR_*` em um lugar versionado — não há enforcement
  automatizado além de `.gitignore`.
- `terraform.tfstate` local (decisão já registrada em
  [ADR-0003](./0003-kubernetes-eks-orquestracao.md)) pode conter os
  valores sensíveis em texto plano no arquivo de state — se esse arquivo
  for commitado ou vazado, os segredos vazam junto. `TODO`: confirmar que
  `terraform.tfstate` está no `.gitignore` (aplicável apenas ao ambiente
  local; a Fase 3 já resolve isso para RDS via
  `manage_master_user_password`, ver [ADR-0004](./0004-banco-dados-gerenciado.md)).

## Riscos

- **Médio**: nenhuma verificação automatizada (ex.: `gitleaks`,
  `trufflehog`) foi encontrada no pipeline de CI para detectar segredo
  commitado por engano — o único scanner de segurança em CI hoje é
  aplicação (ZAP) e imagem (Trivy), nenhum cobre segredo em código-fonte
  ou state do Terraform (ver [ADR-0013](./0013-seguranca-pipeline-zap-trivy.md)).

## Referências

- `infra/modules/kubernetes-apps/` (uso de `templatefile()`)
- `k8s/config/secret.yaml`
- `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md` ("Secret values injected via `templatefile()` — not hardcoded in YAML")
- `README.md` (seção "Infraestrutura como Codigo", variáveis `TF_VAR_*`)
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (não coberto pelas notas originais, adicionado nesta auditoria)
