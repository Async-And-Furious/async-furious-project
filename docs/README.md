# Documentação — Async & Furious

Índice central da documentação técnica e arquitetural do projeto.

Use o [índice por fase](./phases/README.md) para distinguir requisitos,
decisões, desenhos, evidências de implementação/live e referências históricas.
O material da Fase 3 e das fases anteriores permanece disponível abaixo, mas
não é fonte de requisitos da Fase 4. Rótulos como **[ATUAL]** e **[PENDENTE]**
são locais aos documentos e não substituem a verificação do estado real.

## Fase 4 — documentação atual

| Documento | Conteúdo |
|---|---|
| [architecture/saga-flow.md](./architecture/saga-flow.md) | Fonte única do fluxo da Saga coreografada |
| [architecture/service-boundaries.md](./architecture/service-boundaries.md) | Fronteiras dos três serviços e ownership de dados |
| [architecture/event-catalog.md](./architecture/event-catalog.md) | Catálogo de eventos de integração |
| [architecture/edge-topology.md](./architecture/edge-topology.md) | Desenho-alvo da borda da Fase 4 |
| [adr/README.md](./adr/README.md) | Índice e status das decisões; ADRs 0016–0021 aceitas, ADRs 0022–0023 propostas |

Esses documentos registram requisitos/decisões/desenhos conforme indicado no
[índice por fase](./phases/README.md); não são, por si sós, prova de implantação
ou operação. O `architecture/overview.md` é preliminar e requer confirmação do
grupo, conforme ali registrado.

## Catálogo legado de documentos

O catálogo abaixo foi escrito antes da separação por fase e contém documentos
mistos ou históricos. A classificação por fase e autoridade está no
[índice por fase](./phases/README.md); não considere um documento vigente só
porque ele aparece neste catálogo. Não use conteúdo do monólito da Fase 3 como
requisito da Fase 4.

## Arquitetura

| Documento | Conteúdo |
|---|---|
| [architecture/overview.md](./architecture/overview.md) | **Fase 4, preliminar**; data 02/11/2026 futura em relação à revisão de 28/10; não aprovada até confirmação |
| [architecture/component-diagram.md](./architecture/component-diagram.md) | Diagrama de componentes; fase/status precisam seguir o próprio documento e o índice por fase |
| [architecture/deployment-diagram.md](./architecture/deployment-diagram.md) | Desenho de deployment local/AWS; não é evidência de recursos implantados |
| [architecture/edge-topology.md](./architecture/edge-topology.md) | **Fase 4**: desenho-alvo de API Gateway, ALB e rotas; validar implantação separadamente |
| [architecture/saga-flow.md](./architecture/saga-flow.md) | **Fase 4**: fonte única do fluxo distribuído da Saga |
| [architecture/event-catalog.md](./architecture/event-catalog.md) | **Fase 4**: catálogo de eventos de integração |
| [architecture/service-boundaries.md](./architecture/service-boundaries.md) | **Fase 4**: fronteiras dos três serviços e ownership |
| [architecture/persistence-model.md](./architecture/persistence-model.md) | **Fase 4**: read model do OS Service no DocumentDB; validar estado runtime separadamente |
| [architecture/authentication-flow.md](./architecture/authentication-flow.md) | Fluxos mistos; reconciliar autenticação local/legada com ADR-0021 e a borda Fase 4 |
| [architecture/service-order-flow.md](./architecture/service-order-flow.md) | Fluxo síncrono atual/legado; não confundir com `saga-flow.md` da Fase 4 |

## Infraestrutura

| Documento | Conteúdo |
|---|---|
| [infrastructure/aws.md](./infrastructure/aws.md) | Infraestrutura cross-repo; verificar região, owners e ambiente contra fatos atuais antes de uso |
| [infrastructure/api-gateway-lambda.md](./infrastructure/api-gateway-lambda.md) | Auth/borda serverless, parte herdada; contrato atual de rotas é `edge-topology.md`/ADR-0021 |
| [infrastructure/kubernetes.md](./infrastructure/kubernetes.md) | Instruções mistas de `kind` e EKS; conferir fase e branch antes de executar |
| [infrastructure/database.md](./infrastructure/database.md) | Material misto de RDS e ownership; ADR-0020 define o isolamento da Fase 4 |
| [infrastructure/cicd.md](./infrastructure/cicd.md) | Snapshot legado com referências a quatro repositórios; não usar como contrato atual da esteira da Fase 4 |
| [infrastructure/observability.md](./infrastructure/observability.md) | **Fase 4 / #316**, com legado New Relic; distinguir contrato requerido, implementação e validação pendente |
| [runbooks/aws-setup.md](./runbooks/aws-setup.md) | Runbook operacional; revisar ambiente e workflow atuais antes de usar |
| [runbooks/comprehensive-seed.md](./runbooks/comprehensive-seed.md) | Runbook misto; verificar compatibilidade com pipeline HML-only antes de usar |

## Domínio

| Documento | Conteúdo |
|---|---|
| [ddd.md](./ddd.md) | Linguagem ubíqua, Bounded Contexts, modelo tático, Event Storming |
| [domain/revisao-fase3.md](./domain/revisao-fase3.md) | **Fase 3 — histórico**, não fonte de requisitos atuais |
| [context-map/](./context-map/suggestions/), [domain-storytelling/](./domain-storytelling/suggestions/), [event-storming/](./event-storming/suggestions/), [others/](./others/suggestions/) | Artefatos originais de modelagem colaborativa |

## Decisões

- **ADRs**: ver [adr/README.md](./adr/README.md) para fase e status de cada
  decisão; ADRs 0016–0021 estão aceitas na Fase 4 e 0022–0023 são propostas.
  ADRs antigas e [notas das fases anteriores](./adr/notas-fases-anteriores.md)
  são contexto, não autoridade da Fase 4.
- **RFCs**: ver [rfcs/README.md](./rfcs/README.md). RFC-003 (integração API
  Gateway e EKS), RFC-004 (ownership de VPC), RFC-006 (segredos e assinatura
  JWT), RFC-007 (exceção de acesso público do RDS em homologação) e a
  [justificativa de banco de dados](./rfcs/database-justification.md).

## Outros documentos

| Documento | Conteúdo |
|---|---|
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

## Pendências gerais — snapshot sem fase confirmada

> Os itens abaixo são um registro histórico do repositório e não devem ser
> usados como lista de aceite da Fase 4 sem revalidação.

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
