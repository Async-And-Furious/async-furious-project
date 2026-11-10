# Documentos por fase

Este índice separa o material por fase e pelo tipo de evidência que ele
representa. A documentação permanece em seus locais atuais; esta página é um
mapa, não uma mudança de autoridade nem de conteúdo.

## Fase 4 — referência atual

Para decisões e arquitetura da Fase 4, use os documentos atuais abaixo. Não use
descrições do monólito das Fases 1–3 para inferir requisitos da Fase 4.

| Tipo | Fonte | O que estabelece |
|---|---|---|
| Requisito | Especificação do desafio no workspace (`docs/specs/tech-challenge-fase4.md`) | Referência de workspace para o que o desafio exige; não comprova implementação e não é link público. |
| Decisão aceita | [ADRs 0016–0021](../adr/README.md) | Decisões arquiteturais aceitas para a Fase 4. |
| Decisão proposta | [ADR-0022](../adr/0022-integracao-mercado-pago-checkout-pro.md) e [ADR-0023](../adr/0023-ferramenta-bdd-suite-saga.md) | Propostas ainda não aprovadas; não as trate como decisões vigentes. |
| Desenho de arquitetura | [Fluxo único da Saga](../architecture/saga-flow.md), [fronteiras de serviço](../architecture/service-boundaries.md), [catálogo de eventos](../architecture/event-catalog.md) e [topologia da borda](../architecture/edge-topology.md) | Desenhos e contratos arquiteturais da Fase 4, não prova de que estão implantados. `saga-flow.md` é a fonte única do fluxo da Saga. |
| Evidência de implementação | Código, testes e workflows nos repositórios de cada serviço | Estado implementado deve ser verificado no repositório e branch pertinentes; documentação de desenho, sozinha, não demonstra implementação. |
| Evidência operacional/live | Estado observado nos ambientes, pipelines e recursos efetivamente implantados | Confirme ambiente e data da observação. Um diagrama ou workflow não comprova estado live. |

O [overview de arquitetura](../architecture/overview.md) declara-se preliminar,
e traz a data **02/11/2026**. O cabeçalho agenda a revisão de fechamento para
depois do encerramento da Saga (**08/11/2026**); confirme se a aprovação ocorreu
antes de usá-lo como referência normativa.

### Repositórios da Fase 4

Os seis repositórios do projeto são `async-furious-project` (OS Service),
`repo-billing` (Billing Service), `repo-execucao-service` (Execução e
Produção), `repo-k8s-infra`, `repo-db-infra` e `repo-auth-serverless`.
`repo-billing-service` é um nome descontinuado, não o repositório atual. O
`async-furious-front` existe, mas está fora do escopo da Fase 4.

## Fases 1 e 2 — referência histórica

As [ADRs 0006–0015](../adr/README.md) registram retroativamente decisões das
Fases 1 e 2. As fontes disponíveis não estabelecem de modo confiável qual ADR
pertence exclusivamente a qual fase; portanto, não se atribui essa divisão.
Consulte também as [notas das fases anteriores](../adr/notas-fases-anteriores.md),
que são material de trabalho, não ADR nem autoridade para a Fase 4.

## Decisões da Fase 3

As [ADRs 0001–0005](../adr/README.md) referem explicitamente à Fase 3,
incluindo a proposta de EKS da ADR-0003. Consulte o status individual no índice
de ADRs.

## Fase 3 — material histórico

Documentos sobre a topologia monolítica, quatro repositórios, infraestrutura e
fluxos existentes descrevem o histórico/estado da Fase 3. Permanecem
descobríveis em suas pastas originais, mas não definem requisitos da Fase 4;
use as decisões aceitas e fontes atuais da Fase 4 acima para essa finalidade.

## Como interpretar as fontes

- **Requisito** diz o que o desafio pede; não é uma escolha de arquitetura nem
  evidência de que foi entregue.
- **Decisão aceita** registra uma escolha aprovada; não prova implementação.
- **Decisão proposta** aguarda aprovação e não deve ser apresentada como
  vigente.
- **Evidência de implementação** vem do código/testes/workflows e deve ser
  conferida no repositório e branch relevantes.
- **Evidência operacional/live** exige observação do ambiente real, com escopo
  e data; documentação não substitui essa verificação.
- **Referência histórica** preserva contexto de fases anteriores, sem autoridade
  para redefinir a Fase 4.
