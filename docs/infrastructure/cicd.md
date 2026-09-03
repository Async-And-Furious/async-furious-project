# CI/CD

## [ATUAL] `async-furious-project`

Evidência: `.github/workflows/*.yml`.

| Workflow | Gatilho | O que faz |
|---|---|---|
| `tests.yml` | `push` main/develop, `pull_request` | Sobe Postgres 16 de serviço, instala deps (pnpm), gera client Prisma, roda testes unitários, aplica schema, roda testes e2e, lint, build |
| `terraform.yml` | `pull_request` (paths `infra/**`, `k8s/**`); `push` main/develop (mesmos paths + `Dockerfile`, `scripts/local-up.sh`); `workflow_dispatch` | Em PR: só `terraform validate`+`plan`, publica plano como artifact. Em push/manual: builda imagem, sobe cluster `kind` efêmero no runner, aplica de verdade, testa `/api/v1`, destrói tudo — nunca toca nuvem persistente |
| `trivy.yml` | `push` main/develop, `pull_request`, semanal, `workflow_dispatch` | Builda imagem Docker, scan de vulnerabilidades (HIGH/CRITICAL), publica SARIF no code scanning; gate falha o job se houver vulns (mas com `continue-on-error`, não bloqueia hard) |
| `zap.yml` | `pull_request` main/develop, semanal, `workflow_dispatch` | DAST com OWASP ZAP — baseline scan em PRs, full API scan agendado/manual, contra `/api/docs-json` |

**Cobertura mínima de testes exigida**: 80% uniforme em todas as métricas
(`jest.config.js:33-39`) — o `README.md` afirma 85% em statements/lines,
divergência já registrada em
[ADR-0014](../adr/0014-cobertura-minima-testes.md).

## [PROPOSTA FASE 3 — esqueleto] Repositórios satélite

Cada um dos três repositórios tem apenas um `ci.yml` de **validação**, sem
pipeline de `apply`/deploy real:

| Repositório | `ci.yml` | Gatilho |
|---|---|---|
| `repo-auth-serverless` | `npm install && npm run lint && npm run typecheck && npm test` | `pull_request`, `push` main/homolog |
| `repo-k8s-infra` | `terraform fmt -check -recursive && terraform init -backend=false && terraform validate` | `pull_request`, `push` main/homolog |
| `repo-db-infra` | mesmo padrão do `repo-k8s-infra` | `pull_request`, `push` main/homolog |

Branches como `ci/eks-pipeline-plan-apply-trivy` (em `repo-k8s-infra`),
`ci/rds-pipeline-plan-apply-trivy` (em `repo-db-infra`) e
`ci/add-lint-typecheck-build-trivy` (em `repo-auth-serverless`) existem e
sugerem, pelo nome, pipelines de deploy/scan mais completos em
desenvolvimento — **conteúdo não auditado nesta tarefa**, `TODO` revisar
antes de considerar o CI/CD desses repositórios pronto para produção.

## Divergência de nomenclatura de branch

Os três repositórios satélite usam `main`/`homolog` como branches de
deploy; `async-furious-project` usa `main`/`develop`. Nenhuma decisão
formal encontrada justifica ou alinha essa diferença — `TODO` confirmar se
é intencional (ambientes de homologação vs. desenvolvimento contínuo) ou
apenas inconsistência de configuração inicial dos repositórios.

## Pendências

- `TODO`: nenhum pipeline de deploy real (aplicar Terraform contra AWS de
  verdade, publicar imagem no ECR) foi confirmado em nenhum dos três
  repositórios satélite.
- `TODO`: segredos de nuvem (credenciais AWS) para rodar `terraform apply`
  contra ambientes reais não foram encontrados configurados em nenhum dos
  repositórios (esperado, dado que nenhum `apply` real ocorreu ainda).
