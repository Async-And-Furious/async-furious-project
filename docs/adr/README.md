# ADRs — Async & Furious

Architecture Decision Records para decisões **permanentes e de alto
impacto** da arquitetura da Fase 3. Para decisões técnicas mais detalhadas e
ainda passíveis de evolução, ver [RFCs](../rfcs/README.md).

Nenhum padrão de ADR numerado existia neste repositório antes desta
auditoria (confirmado: nenhuma pasta `docs/adr/` em nenhuma branch
pesquisada). O template abaixo foi definido para esta tarefa e deve ser
seguido pelas próximas ADRs.

## Índice

| ADR | Título | Status |
|---|---|---|
| [ADR-0001](./0001-separacao-quatro-repositorios.md) | Separação da solução em quatro repositórios | Aceita |
| [ADR-0002](./0002-autenticacao-centralizada-api-gateway-serverless.md) | Autenticação centralizada via API Gateway + Function Serverless | Proposta (RFCs do trigo em PR aberto) |
| [ADR-0003](./0003-kubernetes-eks-orquestracao.md) | Kubernetes/EKS como plataforma de orquestração | Aceita |
| [ADR-0004](./0004-banco-dados-gerenciado.md) | Banco de dados gerenciado (RDS PostgreSQL) | Proposta (RFC do trigo em PR aberto) |
| [ADR-0005](./0005-observabilidade.md) | Estratégia de observabilidade | Proposta (sem decisão de ferramenta) |

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
