# ADR-0013: Segurança automatizada no pipeline — OWASP ZAP + Trivy

## Status

Aceita

## Contexto

O enunciado da Fase 1 exigia "relatório de análise de vulnerabilidades". A
equipe precisava cobrir dois tipos distintos de risco: vulnerabilidades na
**aplicação em execução** (API HTTP) e vulnerabilidades na **imagem de
container** (SO + dependências empacotadas).

## Decisão

Dois scanners automatizados no pipeline, cada um cobrindo uma camada
diferente:

- **OWASP ZAP** (`.github/workflows/zap.yml`) — DAST (Dynamic Application
  Security Testing): sobe a aplicação contra um Postgres de serviço e roda
  scan baseline em PRs, ou scan completo de API (contra `/api/docs-json`)
  em schedule semanal/manual. Publica relatório e comenta na PR.
- **Trivy** (`.github/workflows/trivy.yml`) — scan de vulnerabilidades da
  **imagem Docker** (SO + bibliotecas), severidade HIGH/CRITICAL, formato
  tabela + SARIF, com upload para GitHub code scanning. Roda em push,
  PR e schedule semanal.

## Alternativas consideradas

Nenhuma alternativa a nenhum dos dois scanners está documentada — ambos
são ferramentas open-source padrão de mercado para suas respectivas
categorias (DAST vs. scan de imagem), adotadas sem registro de comparativo
com concorrentes (ex.: Snyk, Grype, Burp Suite).

## Consequências positivas

- Cobertura complementar: ZAP encontra problemas de comportamento da API
  em runtime (ex.: headers ausentes, endpoints expostos); Trivy encontra
  CVEs conhecidas em pacotes do SO/dependências antes mesmo do deploy.
- Resultados do Trivy integrados ao GitHub code scanning — visibilidade
  nativa na aba "Security" do repositório, sem ferramenta externa.
- Execução automática recorrente (schedule semanal) pega vulnerabilidades
  novas descobertas *depois* do último push, não só no momento do commit.

## Consequências negativas

- O gate do Trivy (falhar o job se houver HIGH/CRITICAL) usa
  `continue-on-error: true` — ou seja, **não bloqueia de fato** o merge
  mesmo com vulnerabilidade crítica encontrada; funciona como alerta, não
  como bloqueio automático.
- Nenhum SLA ou processo documentado de "o que fazer quando o ZAP/Trivy
  encontra algo" além de existir o relatório — depende de revisão manual
  humana para agir sobre os achados.

## Riscos

- **Médio**: `continue-on-error: true` no gate do Trivy significa que
  vulnerabilidades críticas em dependências podem ser mescladas sem
  bloqueio automático — `TODO` avaliar se isso deveria virar um bloqueio
  hard antes de qualquer deploy real de produção (hoje não há deploy real
  fora do runner efêmero, então o risco prático é baixo, mas cresce se/
  quando a Fase 3 chegar a produção de verdade).

## Referências

- `.github/workflows/zap.yml`
- `.github/workflows/trivy.yml`
- `README.md` (seção "Tecnologias", "Seguranca DAST")
- `docs/contexto-tecnico-consolidado.md` §8
- [`docs/infrastructure/cicd.md`](../infrastructure/cicd.md)
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #12 — Trivy não estava nas notas originais, adicionado nesta auditoria)
