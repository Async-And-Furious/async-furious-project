# Template de esteira dos serviços (Fase 4)

> Issue #316. A implementação dos workflows (Sonar, gate de cobertura,
> proteção de branch, Node 22) é do OS Service, na #333: **a cópia do OS é
> o template**. Este documento só diz o que copiar, o que ajustar e o que
> deixar para trás. Ver também [cicd.md](cicd.md) e o contrato de log em
> [observability.md](observability.md#contrato-de-log-issue-316).

## Como um serviço novo nasce

1. Criar o repositório e copiar os arquivos da lista "Copiar" abaixo, a
   partir da `main` do OS Service depois do merge da #333.
2. Trocar os parâmetros da tabela "Parâmetros por serviço".
3. Criar os secrets e variáveis do GitHub do repositório novo (GitHub não
   compartilha secret entre repositórios).
4. Ligar a proteção da `main` (PR obrigatório e checagens do `tests.yml`
   e do Sonar como obrigatórias), igual ao OS.

Cada repositório tem a **própria esteira**: build, testes, cobertura,
Sonar, scan e deploy rodam no repositório do serviço. Não existe workflow
central disparando o deploy dos três.

## Copiar

| Arquivo | Observação |
|---|---|
| `.github/workflows/tests.yml` | Unit, e2e com Postgres de serviço, lint e build. Na versão da #333, com `pnpm test:cov` (hoje roda `pnpm test`, sem o gate; ver [ADR-0014](../adr/0014-cobertura-minima-testes.md)) |
| `.github/workflows/deploy-eks.yml` | Adaptado: namespace, ECR e secrets do serviço (ver abaixo) |
| `.github/workflows/trivy.yml` | Scan de imagem e IaC ([ADR-0013](../adr/0013-seguranca-pipeline-zap-trivy.md)) |
| `.github/workflows/zap.yml`, `.github/zap.conf`, `.zap/rules.tsv` | DAST contra `/api/docs-json`; ver ressalva do Kafka na ADR-0013 |
| Workflow do Sonar | Criado na #333; ainda não existe neste repositório |
| `sonar-project.properties` | Trocar `sonar.projectKey` |
| `jest.config.js` | `coverageThreshold.global` em 80, sem mudança |
| `.nvmrc` | `22` |
| `Dockerfile` | `FROM node:22-slim` nos dois estágios |
| `k8s/` | Manifests e overlay `aws`, com nomes trocados |
| `src/shared/infrastructure/logging/pino-logger.config.ts` | Com o spec `test/shared/pino-logger.config.spec.ts` |
| `README.md` | Na versão da #333, já com 80% uniforme |

## Não copiar

- **Bootstrap de banco** (`scripts/db-bootstrap/`): Job idempotente que
  prepara os bancos do OS, Billing e Execução no RDS compartilhado. Roda só
  a partir do OS ([ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md)).
- **Recursos de DocumentDB do OS**: variáveis de conexão, CA bundle, secret
  `tc3-docdb-os-<env>`, criação de coleções e índices, e o job de rebuild
  da projeção ([ADR-0019](../adr/0019-documentdb-read-model-os-cliente.md)).
- **CronJob do detector** do OS.
- **Workflows de operação e diagnóstico da Fase 3**: `up.yml`, `down.yml`,
  `cleanup-eks.yml`, `seed-eks.yml`, `full-acceptance.yml`,
  `observability-alert-scenarios.yml`, `auth-seed-fingerprint-diagnostics.yml`,
  `customer-lookup-diagnostics.yml`, `protected-route-diagnostics.yml` e
  `protected-route-matrix.yml`.
- **`terraform.yml`** e o cluster `kind` efêmero do CI: continuam só neste
  repositório ([ADR-0012](../adr/0012-cicd-github-actions-apply-efemero.md)).

## Parâmetros por serviço

| Parâmetro | Onde | Exemplo no OS |
|---|---|---|
| Nome do serviço | `SERVICE_NAME` no ConfigMap, `package.json`, manifests | `os-service` (padrão do logger) |
| Namespace | variável `K8S_NAMESPACE` do repositório e `k8s/namespace.yaml` | `async-furious` |
| Repositório ECR | variável `ECR_REPOSITORY` | (definido no GitHub do OS) |
| Projeto Sonar | `sonar.projectKey` | `Async-And-Furious_async-furious-project` |
| Secrets | secrets do GitHub do repositório | os do `deploy-eks.yml` do serviço |

## Secrets por namespace

`Secret` do Kubernetes não cruza namespace, então o `deploy-eks.yml` de cada
serviço materializa os próprios: credencial do banco do serviço, Kafka e
`NEW_RELIC_LICENSE_KEY`. O padrão dos serviços novos é Secrets Manager →
`Secret` no namespace do serviço; o `templatefile()` da
[ADR-0015](../adr/0015-segredos-kubernetes-templatefile.md) fica restrito
ao ambiente local.

## Migration e seed

Cada serviço tem o próprio migration Job (`k8s/app/migration-job.yaml` e o
equivalente no overlay `aws`) rodando `prisma migrate deploy` antes do
deploy da aplicação. O seed é **opcional por serviço**: só entra quem
precisa de dado inicial.

## Dívida técnica: cópia em vez de `workflow_call`

Os workflows são copiados, não chamados como reusable workflow. É mais
simples de entender e cada serviço fica independente, mas corrigir a
esteira passa a exigir a mesma mudança em até três repositórios. Se isso
doer na prática, o caminho é transformar `tests.yml`/`deploy-eks.yml` em
`workflow_call` (o `deploy-eks.yml` já aceita esse gatilho) e chamar a
partir de cada serviço.

## Validação

- **OS Service (#333)**: o template é a própria esteira do OS.
- **Primeira cópia (Execução, #319)**: registrada no #319, não bloqueia o
  fechamento da #316.
