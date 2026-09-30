# ADR-0021: Borda sem BFF — autenticação 100% no Lambda Authorizer e roteamento direto por path

## Status

Aceita

## Contexto

Com a divisão em três serviços (ADR-0017: OS Service, Billing Service,
Execução e Produção), é preciso decidir quem autentica a requisição e como o
tráfego chega a cada serviço. Hoje coexistem duas camadas de autenticação:

- o JWT local dentro do monólito (`src/auth/`,
  [ADR-0008](./0008-autenticacao-local-jwt-rbac.md));
- o Lambda Authorizer de `repo-auth-serverless`
  ([ADR-0002](./0002-autenticacao-centralizada-api-gateway-serverless.md)),
  já implementado e testado na Fase 3, que valida assinatura, emissor,
  audiência e expiração do token RS256.

Hoje a aplicação revalida o token depois do authorizer (ver
`docs/architecture/authentication-flow.md`). Com três serviços, manter essa
revalidação significaria replicá-la três vezes. O enunciado da Fase 4 não trata
de autenticação nem de gateway ou BFF; só exige repositório próprio por serviço
e deploy automatizado em Kubernetes (p.5). A decisão é, portanto, do grupo
(F5/5.1 e 5.2 do `fase4-decisoes-epico1.md`, fechadas em 21/09/2026).

O projeto também não tem frontend no escopo da Fase 4 (o `async-furious-front`
não faz parte da entrega), o que elimina o consumidor típico de um BFF.

## Decisão

1. **Autenticação 100% na borda.** O Lambda Authorizer (`authorize-request`)
   valida o token; **nenhum serviço revalida**. Billing Service e Execução e
   Produção nascem **sem middleware de JWT**; o OS Service pode remover o seu
   (a remoção efetiva é escopo do Epic do OS Service, não desta ADR). O
   Authorizer é reaproveitado como está, sem reescrita.
2. **Roteamento direto por path no API Gateway**, sem BFF, mantendo o caminho
   atual API Gateway → VPC Link → ALB interno, agora com três destinos:

   | Path de entrada | Serviço de destino |
   |---|---|
   | `/os/*` | OS Service |
   | `/billing/*` | Billing Service |
   | `/execucao/*` | Execução e Produção |
   | `POST /auth` | Lambda `authenticate-customer` (rota pública, inalterada) |

   O mapa detalhado, com as consequências de rota, está em
   [`docs/architecture/edge-topology.md`](../architecture/edge-topology.md).
3. **Contrapartidas obrigatórias**, sem as quais a decisão 1 não é segura:
   - **Network policy**: só o load balancer alcança os pods dos serviços;
     acesso direto (inclusive de outro pod do cluster) é bloqueado.
   - **Modo de bypass para desenvolvimento local**: especificado em
     `edge-topology.md`, com critério de ativação restritivo.
4. **Ambientes: a Fase 4 é HML-only.** Não haverá PROD na Fase 4 e nenhuma
   decisão de PROD é tomada aqui. O PROD da Fase 3 permanece como está.
5. **Cluster Kubernetes compartilhado** pelos três serviços, em namespaces e
   deployments separados. A defesa por escrito (custo de conta acadêmica,
   risco de ponto único de falha) está na
   [ADR-0020](./0020-bancos-compartilhados-isolamento-credencial.md), junto
   com a da instância RDS compartilhada, como decidido em conjunto; esta ADR
   apenas a referencia.
6. A [ADR-0008](./0008-autenticacao-local-jwt-rbac.md) passa a **Substituída**
   por esta ADR.

## Alternativas consideradas

- **JWT replicado em cada serviço** (cada um com seu guard/strategy):
  recusada. Reimplementa três vezes uma validação que o Authorizer já faz e
  tem testes automatizados; três superfícies para divergir em claims, chave
  pública e expiração.
- **Biblioteca compartilhada de validação de token**: recusada. Reacopla os
  serviços por pacote e exige publicação e versionamento de pacote, o mesmo
  motivo pelo qual o catálogo de eventos usa tipos duplicados (ADR-0018).
- **BFF na frente dos serviços**: recusada. Um BFF agrega e adapta respostas
  para um frontend; o projeto não tem frontend, então seria um serviço a mais
  (código, deploy, ponto de falha) para um consumidor inexistente.

## Consequências positivas

- Uma única implementação de validação de token, já testada.
- Serviços novos ficam menores: sem dependência de `@nestjs/jwt`/passport nem
  de chave pública.
- Nenhum componente novo no caminho da requisição: o desenho API Gateway →
  VPC Link → ALB já existe.

## Consequências negativas

- **A borda passa a ser a única barreira**: sem revalidação, um pod alcançado
  diretamente é aceito sem token. Por isso a network policy é requisito, não
  melhoria.
- **Perde-se o RBAC por papel dentro do serviço** se o guard local for
  removido: o Authorizer atual responde apenas `isAuthorized` (valida o token,
  não decide por papel). Autorização por papel (`ADMIN`, `RECEPCIONISTA`,
  `MECANICO`) precisa de decisão própria: propagar claims como contexto do
  Authorizer e/ou manter um guard de papel sem validação de assinatura. Ver
  pendências.
- Ambiente de desenvolvimento local precisa do bypass, que é um vetor de risco
  se ativado por engano em ambiente remoto.
- Cluster único: falha do cluster afeta os três serviços (ver ADR-0020).

## Riscos

- **Alto — bypass ativo em ambiente remoto**: mitigado pelo critério de
  ativação fail-fast definido em `edge-topology.md`.
- **Médio — network policy não aplicada pelo CNI**: o VPC CNI do EKS só impõe
  `NetworkPolicy` com o recurso habilitado. Se não estiver, a política existe no
  cluster e não protege nada. A validação é critério de aceite do card de
  implementação (Epic de Plataforma).
- **Médio — granularidade da policy**: o ALB entrega o tráfego aos pods a partir
  de IPs das subnets privadas, as mesmas dos próprios pods (VPC CNI). Uma regra
  por CIDR de subnet admitiria também tráfego pod-a-pod. A implementação deve
  preferir restringir pela origem do ALB (security group do ALB ou CIDR
  dedicado) e testar o bloqueio entre serviços.

## Pendências para o grupo

- **Emissão do token de staff e modelo `User`**: hoje o login de staff
  (`POST /api/v1/auth/login`) é emitido pela própria aplicação, com a mesma
  chave privada da Lambda (ver `authentication-flow.md` §3). "Autenticação
  100% na borda" cobre a **validação**; quem **emite** token de staff depois
  que o `AuthModule` sair do OS Service não foi decidido em F5/5.1. Enquanto
  isso não for decidido, o `User` permanece com o OS Service (posição
  provisória de `service-boundaries.md`).
- **Rotas públicas** (`@Public()`, aprovação de orçamento da ADR-0011, e o
  webhook do Mercado Pago): o API Gateway só tem `POST /auth` público; as demais
  rotas passam pelo Authorizer. Qualquer rota sem token precisa de rota pública
  explícita no Gateway, a definir no Epic de Plataforma.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.5
- `fase4-decisoes-epico1.md`, seção F5 (fora do repositório, workspace local do grupo)
- Issue [#311](https://github.com/Async-And-Furious/async-furious-project/issues/311) — Definir Topologia de Infraestrutura e Borda
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- [ADR-0002 — Autenticação centralizada via API Gateway + Function Serverless](./0002-autenticacao-centralizada-api-gateway-serverless.md)
- [ADR-0008 — Autenticação e autorização locais](./0008-autenticacao-local-jwt-rbac.md) (substituída)
- [ADR-0017 — Divisão em três microsserviços](./0017-divisao-microsservicos-ownership-dados.md)
- [ADR-0020 — Bancos compartilhados com isolamento por credencial](./0020-bancos-compartilhados-isolamento-credencial.md)
- [`docs/architecture/edge-topology.md`](../architecture/edge-topology.md)
- `repo-auth-serverless` (Lambda Authorizer) e `repo-k8s-infra` (VPC, EKS, ALB)
