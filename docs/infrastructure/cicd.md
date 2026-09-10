# CI/CD

> Cobre os pipelines dos quatro repositórios. Decisões em
> [ADR-0012](../adr/0012-cicd-github-actions-apply-efemero.md) e
> [ADR-0013](../adr/0013-seguranca-pipeline-zap-trivy.md).

## 1. Este repositório

| Workflow | Gatilho | O que faz |
|---|---|---|
| `tests.yml` | push em `main`/`develop`, pull request | Postgres 16 de serviço, `pnpm install`, client Prisma, testes unitários, push do schema, testes e2e, lint, build |
| `terraform.yml` | pull request e push em `main`/`develop` com paths `infra/**`, `k8s/**`; `workflow_dispatch` | Em PR, apenas `validate` e `plan`. Em push ou manual, sobe um cluster `kind` efêmero no runner, aplica, inspeciona e descarta |
| `deploy-eks.yml` | push em `main`/`develop` com paths de código, `workflow_dispatch`, `workflow_call` | Publica a imagem no ECR e implanta no EKS. Detalhado abaixo |
| `cleanup-eks.yml` | `workflow_dispatch`, `workflow_call` | Remove os recursos da aplicação do cluster |
| `up.yml` | `workflow_dispatch` | Atalho: chama `deploy-eks.yml` com `environment: hml` |
| `down.yml` | `workflow_dispatch` | Atalho: chama `cleanup-eks.yml` com `operation: destroy` |
| `trivy.yml` | push em `main`/`develop`, pull request, semanal (segunda 04:00), manual | Constrói a imagem, publica relatório em tabela e SARIF, e roda um gate final com `exit-code: 1` para HIGH e CRITICAL |
| `zap.yml` | pull request para `main`/`develop`, semanal (segunda 03:00), manual | DAST: baseline em PR, full API scan agendado ou manual, contra a aplicação subida no runner com credenciais descartáveis |

A cobertura mínima exigida é 80% em todas as métricas (`jest.config.js`). O
`README.md` afirma 85% em statements e lines; a divergência está registrada em
[ADR-0014](../adr/0014-cobertura-minima-testes.md).

### `deploy-eks.yml`

Cinco jobs, encadeados por `needs`:

| Job | Ambiente GitHub | Papel |
|---|---|---|
| `image` | `hml` ou `production` | Constrói e publica a imagem, produz o digest |
| `deploy-hml` | `hml` | Aplica no cluster de homologação |
| `deploy-prod` | `production` | Aplica no cluster de produção |
| `smoke-hml` | `hml` | Verifica alvos saudáveis e rejeição sem token |
| `smoke-prod` | `production` | Idem, em produção |

O `concurrency` é por ambiente, com `cancel-in-progress: false`, então dois
deploys no mesmo alvo enfileiram em vez de se atropelar.

Produção só é alcançada por push em `main`, ou por `workflow_dispatch` a partir
de `main`, e o job de seed exige a entrada explícita `seed_prod: true`.

O job de build reusa uma imagem já publicada com a mesma tag de SHA em vez de
falhar, o que torna o workflow idempotente e permite reexecutar um deploy sem
reconstruir. O que trafega entre os jobs é o digest, não a tag.

O smoke test não verifica se a aplicação responde: verifica se ela **não**
responde sem autenticação. Ele chama `/api/v1/health/live` pelo endpoint do
API Gateway e falha se o retorno não for `401` ou `403`, além de exigir pelo
menos um alvo saudável no target group.

## 2. Repositórios satélite

Os três compartilham o mesmo desenho de pipeline, e todos aplicam
infraestrutura de verdade.

| Repositório | `validate` | `plan` | `apply` | `destroy` |
|---|---|---|---|---|
| `repo-k8s-infra` | `terraform fmt -check`, `init -backend=false`, `validate` | sim, com artefato | sim | `destroy-plan` e `destroy` |
| `repo-db-infra` | idem | sim, com artefato | sim | job dedicado |
| `repo-auth-serverless` | `lint`, `typecheck`, `build`, `package`, mais `fmt`/`validate` do Terraform de `hml` e `prod` | sim, com o `dist.zip` no artefato | sim | no mesmo job do plan |

Três propriedades valem destacar:

**O plano é o contrato.** O `apply` não recalcula o plano: baixa o artefato
salvo pelo job anterior e aplica exatamente aquele arquivo
(`terraform apply -input=false -auto-approve tfplan`). Em
`repo-auth-serverless`, o `dist.zip` das Lambdas viaja no mesmo artefato, de
modo que o binário aplicado é bit a bit o que foi planejado.

**Produção é manual e confirmada por digitação.** Apply em `prod` por
`workflow_dispatch` exige `confirm = "APPLY PROD"` exato, e o job roda no
GitHub Environment `production`, que pode exigir aprovação. Destruição exige
`DESTROY HML` ou `DESTROY PROD`.

**Trivy nos três.** Cada satélite tem `trivy.yml` com o mesmo padrão de dois
passos: um scan informativo que publica SARIF (`exit-code: 0`) e um gate que
falha o job em HIGH ou CRITICAL (`exit-code: 1`). Os repositórios de
infraestrutura usam `scan-type: config` (IaC); `repo-auth-serverless` usa
`scan-type: fs` (dependências e código).

### Mapeamento de branch para ambiente

| Branch | Ambiente |
|---|---|
| `develop` | `hml` |
| `main` | `prod` |

Vale para os quatro repositórios. A nomenclatura `main`/`homolog` citada em
versões anteriores desta documentação não corresponde ao que os workflows
fazem hoje.

## 3. Credenciais

Não há OIDC. A conta é AWS Academy, cujas credenciais são temporárias, então os
workflows usam `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e, no modo Academy,
`AWS_SESSION_TOKEN`, configurados por GitHub Environment
(`hml` e `production`). Eles expiram junto com a sessão do laboratório e
precisam ser renovados antes de qualquer execução.

A fixação de actions por SHA é parcial neste repositório. Os workflows que
tocam a AWS (`deploy-eks.yml`, `cleanup-eks.yml`) fixam tudo por SHA completo,
mas `tests.yml`, `zap.yml` e `terraform.yml` ainda usam
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` e
`actions/github-script@v7` por tag móvel.

Ver [aws-setup.md](../runbooks/aws-setup.md) para a lista de segredos e
variáveis exigidos por ambiente.

## 4. Ordem entre repositórios

Os pipelines não se disparam entre si. A coordenação é manual e a ordem
importa, porque cada um consome outputs do anterior pelo estado remoto:

```
repo-k8s-infra  →  repo-db-infra  →  repo-auth-serverless  →  async-furious-project
```

Um deploy da aplicação contra um ambiente cujo `repo-k8s-infra` não foi
aplicado falha no passo que lê o target group do estado, com mensagem
explícita, antes de tocar o cluster.

## 5. Pendências

- Nenhum gatilho automático entre repositórios. Recriar um ambiente do zero é
  uma sequência manual de quatro execuções, na ordem certa.
- `terraform.yml` coleta logs dos containers `migrate` e `seed`, que não
  existem mais no Deployment. Ver [kubernetes.md](./kubernetes.md).
- `trivy.yml` deste repositório escaneia a mesma imagem três vezes: relatório
  em tabela, relatório SARIF e gate. Os dois primeiros usam `exit-code: 0`,
  apenas o terceiro falha o job.
- Fixação de actions por SHA é parcial (ver seção 3), o que deixa os workflows
  de teste e DAST expostos a mudanças em tags móveis de terceiros.
- Não há verificação de que a versão do schema Prisma aplicada em produção
  corresponde à imagem publicada; o Job de migração e o rollout são passos
  independentes do mesmo workflow.
