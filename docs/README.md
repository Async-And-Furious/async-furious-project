# Documentação — Async & Furious

Índice central da documentação técnica e arquitetural do projeto. Convenção
usada em todo `docs/`: **[ATUAL]** = implementado e rodando hoje;
**[PROPOSTA FASE 3]** = decidido (ADR/RFC aceita), mas não necessariamente
implantado; **[PENDENTE]** = exigido pela Fase 3, sem decisão ainda.

## Arquitetura

| Documento | Conteúdo |
|---|---|
| [architecture/overview.md](./architecture/overview.md) | Visão geral: os quatro repositórios, diagrama de componentes C4, fluxo de comunicação, comunicação entre Bounded Contexts |
| [architecture/component-diagram.md](./architecture/component-diagram.md) | Diagrama de Componentes detalhado, com tabela nome/responsabilidade/tecnologia/comunicação |
| [architecture/deployment-diagram.md](./architecture/deployment-diagram.md) | Diagrama de Implantação — ambiente local (`kind`) e proposta AWS |
| [architecture/authentication-flow.md](./architecture/authentication-flow.md) | Sequência de autenticação — atual (JWT local) e proposta (API Gateway + Function Serverless), com fluxos de erro |
| [architecture/service-order-flow.md](./architecture/service-order-flow.md) | Sequência de abertura e acompanhamento da Ordem de Serviço |

## Domínio

| Documento | Conteúdo |
|---|---|
| [ddd.md](./ddd.md) | Linguagem ubíqua, Bounded Contexts, modelo tático, Event Storming (fonte original, não Fase 3) |
| [domain/revisao-fase3.md](./domain/revisao-fase3.md) | Revisão do Context Map, Domain Storytelling e Event Storming à luz da Fase 3 |
| [context-map/](./context-map/suggestions/), [domain-storytelling/](./domain-storytelling/suggestions/), [event-storming/](./event-storming/suggestions/), [others/](./others/suggestions/) | Artefatos originais de modelagem colaborativa (Mermaid `.mmd`, imagens) |

## ADRs (decisões arquiteturais permanentes)

Ver [adr/README.md](./adr/README.md) — 5 ADRs cobrindo separação em quatro
repositórios, autenticação centralizada, Kubernetes/EKS, banco gerenciado e
observabilidade (esta última sem decisão, documentando o gap).

## RFCs (decisões técnicas)

Ver [rfcs/README.md](./rfcs/README.md) — RFC-003 (API Gateway/EKS), RFC-004
(ownership de VPC), RFC-006 (segredos/JWT) e a justificativa de banco de
dados já foram escritas pelo trigo, cada uma em PR aberto próprio. Não
duplicadas nesta branch — o índice aponta para os PRs até que sejam
mescladas.

## Infraestrutura

| Documento | Conteúdo |
|---|---|
| [infrastructure/kubernetes.md](./infrastructure/kubernetes.md) | Manifests `k8s/`, ambiente `kind` local e proposta EKS |
| [infrastructure/database.md](./infrastructure/database.md) | Versões de Postgres por ambiente, proposta RDS |
| [infrastructure/observability.md](./infrastructure/observability.md) | Estado (ausente) e o que a Fase 3 exige |
| [infrastructure/cicd.md](./infrastructure/cicd.md) | Workflows deste repositório e dos três repositórios satélite |

## Outros documentos

| Documento | Conteúdo |
|---|---|
| [contexto-tecnico-consolidado.md](./contexto-tecnico-consolidado.md) | Síntese técnica cruzada de toda a documentação pré-existente (histórico da Fase 1/2) |
| [reports/relatorio-e2e-orcamento-curl.md](./reports/relatorio-e2e-orcamento-curl.md) | Evidência E2E real do fluxo de orçamento via cURL |
| [http/insomnia.yaml](./http/insomnia.yaml), [http/ciclo-completo-os.http](./http/ciclo-completo-os.http) | Coleções de API |
| [superpowers/specs/2026-06-22-terraform-kubernetes-design.md](./superpowers/specs/2026-06-22-terraform-kubernetes-design.md) | Spec original de infra Terraform+K8s local (Approved) |

## Como visualizar os diagramas

Todos os diagramas são **Mermaid**, a mesma tecnologia de diagrama-como-código
já usada no `README.md` raiz e nos arquivos `.mmd` de `docs/`:

- No GitHub, blocos ` ```mermaid ` renderizam automaticamente.
- No VS Code, use a extensão "Markdown Preview Mermaid Support" ou similar.
- Para os arquivos `.mmd` isolados (`context-map`, `event-storming`, etc.),
  use [mermaid.live](https://mermaid.live) ou a mesma extensão.

## Pendências gerais (resumo)

- `HANDOFF.md`, citado por todas as RFCs como fonte mestra de decisões, não
  foi localizado em nenhum dos quatro repositórios.
- Observabilidade: nenhuma ferramenta decidida ([ADR-0005](./adr/0005-observabilidade.md)).
- RFCs/ADRs consolidadas aqui existem em branches remotas ainda não
  mescladas — mesclar é uma ação recomendada, não executada por esta
  auditoria (fora de escopo: esta tarefa não faz commit/push/merge).
- `repo-auth-serverless`, `repo-k8s-infra`, `repo-db-infra`: todos em
  estágio de esqueleto, sem `terraform apply`/deploy real.

Ver [contexto-tecnico-consolidado.md](./contexto-tecnico-consolidado.md) para
o inventário completo de pendências herdadas das Fases 1/2.
