# RFC-009: Escolha da ferramenta de observabilidade (New Relic)

- **Status**: Aceita (retroativa)
- **Data**: 2026-09-14
- **Resolve**: [ADR-0005](../adr/0005-observabilidade.md), seção
  "Alternativas consideradas" ("Não avaliadas com o mesmo rigor de outras
  decisões deste projeto... Não há registro de comparação formal contra
  CloudWatch, Prometheus/Grafana ou Datadog"); requisito do Tech Challenge
  Fase 3 ("Monitoramento e Observabilidade" → "Datadog ou New Relic,
  escolha livre"); issue
  [#180](https://github.com/Async-And-Furious/async-furious-project/issues/180)
- **Fonte da verdade**: este arquivo, em `async-furious-project`.

## Contexto

A ADR-0005 já registra a decisão (New Relic, epic
[#162](https://github.com/Async-And-Furious/async-furious-project/issues/162))
e a implementação: instrumentação da aplicação, integração com o cluster
EKS, logs estruturados, dashboards e alertas, já validados em HML com dado
real em 2026-09-13. O que a ADR-0005 explicita como lacuna é a ausência de
**comparação formal** contra as alternativas: a escolha "já veio definida
no planejamento do épico, não como resultado de uma avaliação de
trade-offs registrada". Esta RFC existe para fechar essa lacuna, no mesmo
espírito de [`database-justification.md`](./database-justification.md)
(justificativa formal escrita depois de uma decisão já tomada na prática).

Há um indício concreto de que uma alternativa foi tentada e abandonada
antes do New Relic: [`docs/infrastructure/observability.md`](../infrastructure/observability.md)
registra a remoção, na issue #164, de "um bloco de middleware solto em
`main.ts` que gravava métricas em formato **CloudWatch EMF**, resíduo de
uma estratégia nunca adotada". Não há registro de por que essa abordagem
foi abandonada além dessa nota.

## Alternativas consideradas

Comparação com dado real de free tier (pesquisado em 2026-09, não
verificado contra contrato/oferta educacional específica, os três
provedores oferecem descontos/planos para estudantes que não foram
cotados aqui):

| Critério | **New Relic** (escolhido) | Datadog | AWS CloudWatch |
|---|---|---|---|
| Free tier | 100 GB/mês de ingestão, sem cartão de crédito | 5 hosts, retenção de métricas de **1 dia**; **log management e APM não incluídos no plano gratuito** | 5 GB/mês de logs grátis; USD 0,50/GB depois; Container Insights cobra por nó/vCPU à parte |
| Cobre logs + APM + infra num único vendor | Sim | Não no plano gratuito (precisaria de upgrade pago) | Não nativamente, APM exigiria X-Ray separado |
| Integração com o padrão de IaC já usado (Terraform + Helm) | Sim (`nri-bundle`, provider `newrelic/newrelic`) | Sim (agente + provider Terraform) | Nativo da AWS, mas por trás da `LabRole` restrita (ver Riscos) |
| Overhead operacional | Baixo (chart Helm único) | Baixo | Médio (agente + configuração de permissões IAM para o Fluent Bit/CloudWatch agent) |

- **Datadog**: citado explicitamente no enunciado do Tech Challenge como
  alternativa. Descartado na prática porque o plano gratuito não inclui
  log management nem APM, dois dos requisitos obrigatórios da Fase 3
  ("logs estruturados", "latência das APIs") ficariam fora do free tier,
  exigindo plano pago para um projeto acadêmico sem orçamento.
- **AWS CloudWatch** (Container Insights + Logs): a opção "nativa" da
  nuvem já escolhida ([RFC-008](./RFC-008-cloud-provider.md)), e a única
  com evidência de ter sido tentada de fato (o resíduo de código EMF
  citado no Contexto). Descartada, ao que tudo indica, por exigir compor
  múltiplas peças (CloudWatch Logs + Container Insights + X-Ray para APM)
  em vez de um agente único, e por depender de permissões IAM no node
  role/service account do EKS, a mesma `LabRole` do AWS Academy que já
  bloqueou outra decisão de rede neste projeto (RFC-007). Não confirmado
  se a `LabRole` de fato bloquearia essas permissões especificamente; é
  inferência por analogia com o caso já documentado, não um teste
  realizado.
- **Prometheus + Grafana** (self-hosted): rejeitado por exigir hospedar e
  manter múltiplos componentes adicionais dentro do próprio cluster
  (Prometheus, Grafana, Alertmanager, e mais Loki/Tempo para cobrir logs e
  tracing), overhead de recursos relevante num cluster com capacidade já
  registrada como limitada pela quota de vCPU da conta AWS Academy (ver
  "Riscos" da ADR-0005).

## Decisão

Manter o **New Relic** (plano gratuito, 100 GB/mês) como plataforma única
de observabilidade, decisão já implementada, sem mudança de
infraestrutura motivada por esta RFC. Ver
[ADR-0005](../adr/0005-observabilidade.md) para o detalhe completo do que
foi implementado (issues #163 a #167).

## Consequências

Já registradas na ADR-0005 (consequências positivas/negativas e riscos).
Esta RFC não introduz consequência nova, apenas formaliza por que as
alternativas não avançaram, com dado concreto de free tier que não
existia no momento da decisão original.

## Referências

- [ADR-0005](../adr/0005-observabilidade.md): decisão e implementação
  completas
- [`docs/infrastructure/observability.md`](../infrastructure/observability.md): estado atual, incluindo o resíduo de código CloudWatch EMF
- [RFC-007](./RFC-007-rds-public-access.md): precedente de limitação da
  `LabRole` do AWS Academy
- [RFC-008](./RFC-008-cloud-provider.md): escolha da AWS/AWS Academy
- Tech Challenge Fase 3 (PDF do enunciado), seção "Monitoramento e
  Observabilidade"
- Datadog: planos e limites do free tier (pesquisa web, 2026-09)
- AWS CloudWatch: pricing de Logs e Container Insights (pesquisa web,
  2026-09)
