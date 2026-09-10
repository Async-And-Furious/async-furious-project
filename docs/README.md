# Documentação — Async & Furious

Índice central da documentação técnica e arquitetural do projeto.

Convenção usada em todo `docs/`: **[ATUAL]** = implementado e rodando hoje;
**[PENDENTE]** = exigido pela Fase 3, sem decisão ainda. A marca
**[PROPOSTA FASE 3]** foi retirada dos documentos de infraestrutura: o que
estava proposto foi implementado, e o que segue pendente está listado ao final
de cada documento.

## Arquitetura

| Documento | Conteúdo |
|---|---|
| [architecture/overview.md](./architecture/overview.md) | Visão geral: os quatro repositórios, diagrama de componentes C4, comunicação entre Bounded Contexts |
| [architecture/component-diagram.md](./architecture/component-diagram.md) | Diagrama de Componentes, com tabela de nome, responsabilidade, tecnologia e comunicação |
| [architecture/deployment-diagram.md](./architecture/deployment-diagram.md) | Diagrama de Implantação: ambiente `kind` local e ambiente AWS (hml e prod) |
| [architecture/authentication-flow.md](./architecture/authentication-flow.md) | Sequência de autenticação nos dois modos (`AUTH_MODE=local` e `gateway`), com fluxos de erro |
| [architecture/service-order-flow.md](./architecture/service-order-flow.md) | Sequência de abertura e acompanhamento da Ordem de Serviço |

## Infraestrutura

| Documento | Conteúdo |
|---|---|
| [infrastructure/aws.md](./infrastructure/aws.md) | Visão geral da nuvem: ownership por repositório, ambientes, estado Terraform compartilhado, VPC, EKS, ECR, ALB, RDS e modo AWS Academy |
| [infrastructure/api-gateway-lambda.md](./infrastructure/api-gateway-lambda.md) | Borda serverless: HTTP API, Lambdas, authorizer, VPC Link, contrato JWT e consumo pelo monólito |
| [infrastructure/kubernetes.md](./infrastructure/kubernetes.md) | Manifests compartilhados, cluster `kind` local, EKS, TargetGroupBinding e a sequência de deploy |
| [infrastructure/database.md](./infrastructure/database.md) | Modelo de dados, versões de Postgres por ambiente e RDS |
| [infrastructure/cicd.md](./infrastructure/cicd.md) | Pipelines dos quatro repositórios, gates de produção e ordem entre eles |
| [infrastructure/observability.md](./infrastructure/observability.md) | Logs estruturados, health checks, alarmes CloudWatch e as lacunas restantes |
| [runbooks/aws-setup.md](./runbooks/aws-setup.md) | Segredos, variáveis e pré-requisitos para os workflows de nuvem |

## Domínio

| Documento | Conteúdo |
|---|---|
| [ddd.md](./ddd.md) | Linguagem ubíqua, Bounded Contexts, modelo tático, Event Storming |
| [domain/revisao-fase3.md](./domain/revisao-fase3.md) | Revisão do Context Map, Domain Storytelling e Event Storming à luz da Fase 3 |
| [context-map/](./context-map/suggestions/), [domain-storytelling/](./domain-storytelling/suggestions/), [event-storming/](./event-storming/suggestions/), [others/](./others/suggestions/) | Artefatos originais de modelagem colaborativa |

## Decisões

- **ADRs**: ver [adr/README.md](./adr/README.md). Quinze decisões
  arquiteturais, da separação em quatro repositórios ao mínimo de cobertura de
  testes, mais [notas das fases anteriores](./adr/notas-fases-anteriores.md).
- **RFCs**: ver [rfcs/README.md](./rfcs/README.md). RFC-003 (integração API
  Gateway e EKS), RFC-004 (ownership de VPC), RFC-006 (segredos e assinatura
  JWT), RFC-007 (exceção de acesso público do RDS em homologação) e a
  [justificativa de banco de dados](./rfcs/database-justification.md).

## Outros documentos

| Documento | Conteúdo |
|---|---|
| [contexto-tecnico-consolidado.md](./contexto-tecnico-consolidado.md) | Síntese técnica da documentação das Fases 1 e 2 |
| [reports/relatorio-e2e-orcamento-curl.md](./reports/relatorio-e2e-orcamento-curl.md) | Evidência E2E do fluxo de orçamento via cURL |
| [http/insomnia.yaml](./http/insomnia.yaml), [http/ciclo-completo-os.http](./http/ciclo-completo-os.http) | Coleções de API |
| [agents/](./agents/), [agent-log.md](./agent-log.md) | Convenções de trabalho assistido e registro de execuções |
| [superpowers/specs/2026-06-22-terraform-kubernetes-design.md](./superpowers/specs/2026-06-22-terraform-kubernetes-design.md) | Spec original da infra Terraform e Kubernetes local |

## Como visualizar os diagramas

Todos os diagramas são Mermaid, a mesma tecnologia já usada no `README.md`
raiz e nos arquivos `.mmd` de `docs/`:

- No GitHub, blocos ` ```mermaid ` renderizam automaticamente.
- No VS Code, use a extensão "Markdown Preview Mermaid Support" ou similar.
- Para os `.mmd` isolados, use [mermaid.live](https://mermaid.live).

## Pendências gerais

- **Observabilidade**: nenhuma stack decidida
  ([ADR-0005](./adr/0005-observabilidade.md)). Os sete alarmes CloudWatch
  existentes não têm destino de notificação.
- **Autenticação administrativa na nuvem**: com `AUTH_MODE=gateway`, só o
  cliente autentica, por CPF. Não há caminho definido para `ADMIN`,
  `RECEPCIONISTA` e `MECANICO`.
- **Promoção das branches dos satélites**: o conteúdo real de
  `repo-k8s-infra`, `repo-db-infra` e `repo-auth-serverless` está em
  `release/v0.1.0`. O `main` dos três ainda é o esqueleto inicial, e a
  documentação de infraestrutura aponta para a branch de release.
- **`k8s/overlays/aws/`**: presente no repositório, mas não referenciado por
  nenhum workflow ou script. Ver
  [infrastructure/kubernetes.md](./infrastructure/kubernetes.md).
- **`HANDOFF.md`**, citado por RFCs como fonte mestra de decisões, não foi
  localizado em nenhum dos quatro repositórios.

Ver [contexto-tecnico-consolidado.md](./contexto-tecnico-consolidado.md) para
o inventário de pendências herdadas das Fases 1 e 2.
