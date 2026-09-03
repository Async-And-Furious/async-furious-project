# ADR-0012: CI/CD via GitHub Actions com `apply` restrito a cluster efêmero

## Status

Aceita

## Contexto

O enunciado da Fase 2 exigia "pipeline CI/CD... deploy no cluster...
aplicação dos manifestos". O spec original de infraestrutura
(`docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`,
Approved) previa inicialmente que o CI/CD faria **apenas**
`terraform validate`+`plan`, nunca `apply` ("No `terraform apply` in CI.
No cloud secrets needed for validate+plan."). O `README.md` (mais recente)
descreve um comportamento adicional que efetivamente aplica infraestrutura
em CI — esse é o ponto que este ADR formaliza, resolvendo a divergência
entre os dois documentos.

## Decisão

GitHub Actions (`.github/workflows/terraform.yml`) com dois
comportamentos por gatilho:

- **Pull Request** que altera `infra/**`/`k8s/**`: só `terraform validate`
  + `terraform plan`, publica o plano como artifact para revisão humana.
  Nenhum `apply`, nenhum cluster criado.
- **Push em `main`/`develop`** (ou `workflow_dispatch` manual): roda um job
  adicional que builda a imagem Docker, provisiona um cluster `kind`
  **efêmero dentro do próprio runner do GitHub**, aplica a infraestrutura
  de verdade (`terraform apply`), faz smoke test em `/api/v1`, e destrói
  tudo (`terraform destroy`) ao final. Nenhuma conta de nuvem é envolvida —
  o cluster nasce e morre dentro do runner.

## Alternativas consideradas

- **Nunca aplicar em CI** (decisão original do spec): descartada
  implicitamente — a equipe evoluiu para exercitar a infraestrutura de
  ponta a ponta a cada push, sem essa nota ter sido atualizada no spec
  original (divergência documental que este ADR resolve).
- **Aplicar contra infraestrutura de nuvem persistente em CI**: não
  adotada — o `apply` acontece só contra um cluster `kind` efêmero e local
  ao runner, nunca contra nuvem persistente, preservando o espírito
  original de "nenhum apply perigoso/irreversível em CI".

## Consequências positivas

- Cada push em `main`/`develop` valida que a infraestrutura *de fato*
  sobe, aplica e funciona (smoke test real em `/api/v1`), não só que os
  arquivos Terraform são sintaticamente válidos.
- Sem risco de `apply` irreversível contra ambiente real — o cluster é
  descartável e destruído ao final do job.
- PRs continuam rápidos e sem custo de infraestrutura (só validate+plan).

## Consequências negativas

- O spec original (`docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`)
  ficou tecnicamente desatualizado nesse ponto específico — continua
  dizendo "No terraform apply in CI" sem a ressalva do cluster efêmero.
- Esse padrão (apply só em cluster efêmero) não necessariamente se traduz
  para os três repositórios satélite da Fase 3 (`repo-k8s-infra`,
  `repo-db-infra`, `repo-auth-serverless`) — eles hoje só têm `ci.yml` de
  validação (`terraform fmt`/`validate` ou `lint`/`test`), sem nenhum job
  de `apply`, efêmero ou não (ver [`docs/infrastructure/cicd.md`](../infrastructure/cicd.md)).

## Riscos

- **Baixo**: nenhum risco de segurança identificado — sem credenciais de
  nuvem envolvidas neste pipeline.
- **Baixo**: divergência documental (spec vs. README) pode confundir quem
  ler só o spec original sem saber que ele está desatualizado neste ponto —
  mitigado por este ADR e por `docs/infrastructure/cicd.md`.

## Referências

- `.github/workflows/terraform.yml`
- `docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`
- `README.md` (seção "CI/CD")
- `docs/contexto-tecnico-consolidado.md` §8 ("Conflito documentado: CI/CD aplica ou não aplica infraestrutura automaticamente?")
- [`docs/infrastructure/cicd.md`](../infrastructure/cicd.md)
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #11)
