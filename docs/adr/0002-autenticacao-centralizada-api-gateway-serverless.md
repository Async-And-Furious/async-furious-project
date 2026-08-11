# ADR-0002: Autenticação centralizada via API Gateway + Function Serverless

## Status

Proposta — decisão detalhada nas RFCs do trigo (RFC-003, RFC-006), ambas em
PR aberto, ainda não mescladas em `main`/`develop` (ver
[`docs/rfcs/README.md`](../rfcs/README.md)). **Implementação em estágio de
esqueleto**, não em produção.

## Contexto

Hoje, autenticação e autorização (JWT + bcrypt, papéis `ADMIN`/
`RECEPCIONISTA`/`MECANICO`) rodam dentro do próprio processo NestJS
(`src/auth/`). A Fase 3 exige um ponto de entrada único (API Gateway) com
autenticação centralizada antes de a requisição alcançar qualquer aplicação
no cluster Kubernetes — inclusive para suportar, no futuro, mais de um
serviço atrás do mesmo Gateway.

## Decisão

Extrair a autenticação para um repositório e processo próprios
(`repo-auth-serverless`), acionado por um API Gateway (HTTP API):

- **Emissão de token**: Function Serverless `authenticate-customer` valida
  CPF e emite um JWT assinado com **RS256**.
- **Validação de token**: Function Serverless `authorize-request`, atuando
  como **Lambda Authorizer customizado** (não o JWT authorizer nativo do API
  Gateway), valida a assinatura e os claims em toda rota protegida.
- **Segredos**: chave privada em AWS Secrets Manager (só as duas Lambdas de
  `repo-auth-serverless` têm acesso); chave pública em SSM Parameter Store
  (não sensível, qualquer verificador futuro pode lê-la sem acesso à chave
  privada).
- **Integração com a aplicação**: API Gateway → VPC Link → ALB interno
  (gerenciado por `repo-k8s-infra` via Kubernetes Ingress) → pods da
  aplicação no EKS.

## Alternativas consideradas

(Registradas na RFC-006 do trigo)

- **JWT authorizer nativo do API Gateway**: rejeitado — exigiria expor um
  endpoint JWKS público, infraestrutura permanente sem outro uso no
  projeto.
- **HS256 (assinatura simétrica)**: rejeitado — todo verificador futuro
  precisaria do mesmo segredo compartilhado, pior ajuste para uma direção de
  microsserviços.
- **REST API + NLB** (em vez de HTTP API + VPC Link + ALB, registrado na
  RFC-003 do trigo): rejeitado — mais caro, e NLB é L4-only, exigindo nova
  wiring de target-group por microsserviço futuro.

## Consequências positivas

- Autenticação isolada do código de negócio — a aplicação NestJS não precisa
  mais implementar a lógica de emissão de token para o cliente final.
- Chave privada nunca sai de `repo-auth-serverless`; qualquer verificador
  futuro (a própria aplicação, ou um futuro microsserviço) só precisa da
  chave pública, não-sensível.
- ALB/Ingress (em vez de NLB) permite adicionar roteamento por path/host para
  futuros microsserviços sem tocar no Gateway ou no VPC Link.

## Consequências negativas

- Novo ponto de falha distribuído: indisponibilidade da Function Serverless
  bloqueia toda autenticação (ver fluxo alternativo em
  [authentication-flow.md](../architecture/authentication-flow.md)).
- Duas implementações de autenticação convivem hoje: `src/auth/` (local,
  JWT+bcrypt, usuários administrativos) e a proposta (`repo-auth-serverless`,
  RS256, cliente final por CPF) — **sem decisão registrada sobre como ou se
  elas se unificam**.

## Riscos

- **Alto — pendência sem decisão**: nenhuma RFC ou ADR encontrada define como
  os três papéis administrativos (`ADMIN`, `RECEPCIONISTA`, `MECANICO`) usam
  este novo fluxo, que hoje só cobre "customer" (cliente final,
  identificado por CPF). `TODO`.
- **Médio**: `authenticate-customer` ainda não tem decidido se acessa o RDS
  diretamente ou via RDS Proxy (registrado como em aberto na própria
  RFC-006).
- **Médio**: os dois handlers Lambda são esqueletos (`501`/
  `isAuthorized: false`) — nenhuma validação real de CPF ou JWT está
  implementada ainda.

## Referências

- RFC-003 (API Gateway/EKS) e RFC-006 (secrets/JWT), do trigo — ver
  [`docs/rfcs/README.md`](../rfcs/README.md)
- [Sequência de autenticação](../architecture/authentication-flow.md)
- `src/auth/` (implementação local atual, `async-furious-project`)
