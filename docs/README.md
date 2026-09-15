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
| [architecture/authentication-flow.md](./architecture/authentication-flow.md) | Sequências de autenticação de staff e cliente, local e AWS, com fluxos de erro |
| [architecture/service-order-flow.md](./architecture/service-order-flow.md) | Sequência de abertura e acompanhamento da Ordem de Serviço |

## Infraestrutura

| Documento | Conteúdo |
|---|---|
| [infrastructure/aws.md](./infrastructure/aws.md) | Visão geral da nuvem: ownership por repositório, ambientes, estado Terraform compartilhado, VPC, EKS, ECR, ALB, RDS e modo AWS Academy |
| [infrastructure/api-gateway-lambda.md](./infrastructure/api-gateway-lambda.md) | Borda serverless: HTTP API, Lambdas, authorizer, VPC Link, contrato JWT e consumo pelo monólito |
| [infrastructure/kubernetes.md](./infrastructure/kubernetes.md) | Manifests compartilhados, cluster `kind` local, EKS, TargetGroupBinding e a sequência de deploy |
| [infrastructure/database.md](./infrastructure/database.md) | Modelo de dados, versões de Postgres por ambiente e RDS |
| [infrastructure/cicd.md](./infrastructure/cicd.md) | Pipelines dos quatro repositórios, gates de produção e ordem entre eles |
| [infrastructure/observability.md](./infrastructure/observability.md) | New Relic (APM, cluster, logs, dashboards e alertas), health checks e alarmes CloudWatch |
| [runbooks/aws-setup.md](./runbooks/aws-setup.md) | Segredos, variáveis e pré-requisitos para os workflows de nuvem |
| [runbooks/comprehensive-seed.md](./runbooks/comprehensive-seed.md) | Seed abrangente em HML e PROD pelo `seed-eks.yml` |

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
| [http/README.md](./http/README.md), [http/routes.yaml](./http/routes.yaml) | Coleções Postman e Insomnia geradas a partir do manifesto de rotas |
| [specs/authenticated-route-matrix.md](./specs/authenticated-route-matrix.md) | Contrato da matriz de rotas autenticadas |
| [http/insomnia.yaml](./http/insomnia.yaml), [http/ciclo-completo-os.http](./http/ciclo-completo-os.http) | Coleções de API anteriores |
| [agents/](./agents/), [agent-log.md](./agent-log.md) | Convenções de trabalho assistido e registro de execuções |
| [superpowers/specs/2026-06-22-terraform-kubernetes-design.md](./superpowers/specs/2026-06-22-terraform-kubernetes-design.md) | Spec original da infra Terraform e Kubernetes local |

## Como visualizar os diagramas

Todos os diagramas são Mermaid, a mesma tecnologia já usada no `README.md`
raiz e nos arquivos `.mmd` de `docs/`:

- No GitHub, blocos ` ```mermaid ` renderizam automaticamente.
- No VS Code, use a extensão "Markdown Preview Mermaid Support" ou similar.
- Para os `.mmd` isolados, use [mermaid.live](https://mermaid.live).

## Pendências gerais

- **Login de staff na AWS**: depende de um token de cliente para atravessar o
  authorizer, e a chave privada RS256 é compartilhada entre a Lambda e a
  aplicação. Ver
  [architecture/authentication-flow.md](./architecture/authentication-flow.md).
- **Papel atribuído ao cliente**: `validateCustomer` devolve
  `RECEPCIONISTA` para tokens de cliente sem `role`.
- **Alarmes CloudWatch da borda**: criados sem destino. Os alertas com
  notificação estão na New Relic e não cobrem Lambdas nem RDS.
- **`k8s/overlays/aws/`**: presente no repositório, mas não referenciado por
  nenhum workflow ou script. Ver
  [infrastructure/kubernetes.md](./infrastructure/kubernetes.md).

Ver [contexto-tecnico-consolidado.md](./contexto-tecnico-consolidado.md) para
o inventário de pendências herdadas das Fases 1 e 2.
