# ADRs — Async & Furious

Architecture Decision Records para decisões **permanentes e de alto
impacto** da arquitetura da Fase 3. Para decisões técnicas mais detalhadas e
ainda passíveis de evolução, ver [RFCs](../rfcs/README.md).

Nenhum padrão de ADR numerado existia neste repositório antes desta
auditoria (confirmado: nenhuma pasta `docs/adr/` em nenhuma branch
pesquisada). Definimos o template abaixo para esta tarefa, que deve ser
seguido pelas próximas ADRs.

## Índice

| ADR | Título | Status |
|---|---|---|
| [ADR-0001](./0001-separacao-quatro-repositorios.md) | Separação da solução em quatro repositórios | Aceita |
| [ADR-0002](./0002-autenticacao-centralizada-api-gateway-serverless.md) | Autenticação centralizada via API Gateway + Function Serverless | Aceita e parcialmente implementada (fluxo de cliente/CPF) |
| [ADR-0003](./0003-kubernetes-eks-orquestracao.md) | Kubernetes/EKS como plataforma de orquestração | Aceita |
| [ADR-0004](./0004-banco-dados-gerenciado.md) | Banco de dados gerenciado (RDS PostgreSQL) | Proposta (RFC do trigo em PR aberto) |
| [ADR-0005](./0005-observabilidade.md) | Estratégia de observabilidade | Aceita (implementação em código, pendente validação — issue #163) |
| [ADR-0006](./0006-clean-architecture-ddd.md) | Clean Architecture + DDD como estilo arquitetural | Aceita |
| [ADR-0007](./0007-stack-tecnologica-aplicacao.md) | Stack tecnológica da aplicação: NestJS + PostgreSQL + Prisma | Aceita |
| [ADR-0008](./0008-autenticacao-local-jwt-rbac.md) | Autenticação e autorização locais: JWT + bcrypt + RBAC via guards | Aceita |
| [ADR-0009](./0009-eventos-dominio-in-process.md) | Comunicação entre Bounded Contexts via eventos de domínio in-process | Aceita (parcialmente substituída pela ADR-0016 para eventos entre serviços da Fase 4) |
| [ADR-0010](./0010-monolito-modular.md) | Monólito modular como topologia de implantação | Substituída (ver ADR-0017) |
| [ADR-0011](./0011-aprovacao-orcamento-api-publica.md) | Aprovação de orçamento via API pública síncrona | Aceita (revisada na Fase 4 — migração do `Orcamento`) |
| [ADR-0012](./0012-cicd-github-actions-apply-efemero.md) | CI/CD via GitHub Actions com `apply` restrito a cluster efêmero | Aceita |
| [ADR-0013](./0013-seguranca-pipeline-zap-trivy.md) | Segurança automatizada no pipeline: OWASP ZAP + Trivy | Aceita |
| [ADR-0014](./0014-cobertura-minima-testes.md) | Cobertura mínima de testes automatizados (80% uniforme) | Aceita |
| [ADR-0015](./0015-segredos-kubernetes-templatefile.md) | Gestão de segredos no Kubernetes local via `templatefile()` | Aceita |
| [ADR-0016](./0016-saga-coreografada.md) | Saga coreografada para a transação distribuída da Fase 4 | Aceita |
| [ADR-0017](./0017-divisao-microsservicos-ownership-dados.md) | Divisão em três microsserviços e ownership de dados por serviço | Aceita |

ADRs 0006-0015 registram decisões das Fases 1 e 2 (retroativas — a solução
já estava construída), a partir do rascunho de descoberta em
[`notas-fases-anteriores.md`](./notas-fases-anteriores.md). ADRs a partir da
0016 registram decisões da Fase 4.

## Template

```markdown
# ADR-XXX: Título

## Status

Proposta | Aceita | Rejeitada | Substituída

## Contexto

## Decisão

## Alternativas consideradas

## Consequências positivas

## Consequências negativas

## Riscos

## Referências
```
