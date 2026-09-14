# RFC-003 — API Gateway e integração com EKS

- **Status**: Aceita
- **Data**: 2026-07-29
- **Fonte da verdade**: este arquivo, em `async-furious-project`. Cópias
  existem em `repo-auth-serverless` e `repo-k8s-infra` para visibilidade
  local — atualizar aqui primeiro, depois sincronizar.

## Contexto

O HANDOFF.md §6.2 (referência histórica a um documento de planejamento —
HANDOFF.md — não encontrado nos repositórios; ver
[`docs/rfcs/README.md`](./README.md)) deixou a ownership do API Gateway em aberto, e o §4.2
sugeriu (sem decidir) uma integração via VPC Link + load balancer interno
entre o Gateway e a aplicação hospedada no EKS. Ambos precisavam de uma
decisão antes que a pipeline de apply do `repo-k8s-infra` ou os recursos de
Gateway do `repo-auth-serverless` pudessem ser implementados de fato.

## Decisão

1. **Ownership**: o `repo-auth-serverless` é dono do recurso de API
   Gateway, das rotas (`/auth`, rotas protegidas) e da associação com o
   Lambda Authorizer. O `repo-k8s-infra` é dono apenas do alvo de
   integração privado (ALB interno) e expõe seu ARN/DNS name como output
   Terraform para o `repo-auth-serverless` consumir.
2. **Integração**: HTTP API (não REST API) com um VPC Link para um
   Application Load Balancer interno na VPC do EKS, usando integração
   `HTTP_PROXY`.

## Justificativa

- As únicas responsabilidades do Gateway (rotas `/auth`, ligação do
  authorizer) já vivem no `repo-auth-serverless` — colocar a ownership no
  mesmo lugar evita uma dependência cross-repo para mudanças que só afetam
  aquele repositório.
- HTTP API + VPC Link + ALB é mais barato e mais simples do que REST API +
  NLB, e nem WAF no gateway, nem usage plans, nem transformação de
  request/response são requisitos atuais.
- A aplicação está planejada para evoluir de monólito para microsserviços.
  O ALB (gerenciado pelo AWS Load Balancer Controller via Kubernetes
  Ingress) suporta adicionar regras de roteamento por path/host por
  serviço sem tocar no Gateway ou no VPC Link. Um NLB (a alternativa sob
  REST API) é apenas L4 e exigiria nova configuração de target-group a
  cada novo microsserviço — esta decisão foi tomada especificamente para
  evitar esse retrabalho mais adiante.

## Consequências

- O `repo-k8s-infra` precisa provisionar um ALB interno (via AWS Load
  Balancer Controller / Ingress) e expor seu DNS name/ARN como output.
- O `repo-auth-serverless` precisa provisionar a HTTP API, as rotas, o VPC
  Link e o Lambda Authorizer, consumindo o output do ALB vindo do
  `repo-k8s-infra`.
- Divisão futura em microsserviços: adicionar regras de Kubernetes Ingress
  + rotas de Gateway incrementalmente, sem rearquitetar esta integração.
