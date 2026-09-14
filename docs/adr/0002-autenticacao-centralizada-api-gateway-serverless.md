# ADR-0002: Autenticação centralizada via API Gateway + Function Serverless

## Status

**Aceito e parcialmente implementado.** A RFC-003 e a RFC-006 estão aceitas.
O `repo-auth-serverless` entrega os dois handlers Lambda (`authenticate-customer`,
`authorize-request`) com CI/CD, Terraform e alarmes do CloudWatch — não são
mais esqueletos. Do lado da aplicação, o PR #182
(`feat/customer-jwt-rs256-auth`) adicionou o consumidor: `JwtCustomerStrategy`
(RS256) e `JwtCustomerAuthGuard`, além de `Role.CLIENTE`. A autenticação de
staff (`ADMIN`/`RECEPCIONISTA`/`MECANICO`) permanece local intencionalmente —
veja "Decisão sobre os papéis de staff" abaixo.

## Contexto

Antes desta mudança, a autenticação e a autorização (JWT + bcrypt, papéis
`ADMIN`/`RECEPCIONISTA`/`MECANICO`) rodavam inteiramente dentro do processo
NestJS (`src/auth/`). A Fase 3 exige um único ponto de entrada (API Gateway)
com autenticação centralizada antes de a requisição chegar a qualquer
aplicação no cluster Kubernetes — incluindo suporte a mais de um serviço por
trás do mesmo Gateway no futuro.

## Decisão

Extrair a autenticação de clientes para seu próprio repositório e processo
(`repo-auth-serverless`), exposto por um API Gateway (HTTP API):

- **Emissão de token**: a Function Serverless `authenticate-customer` valida
  o CPF e emite um JWT assinado com **RS256**.
- **Validação de token**: a Function Serverless `authorize-request`, atuando
  como um **Lambda Authorizer customizado** (não o autorizador JWT nativo do
  API Gateway), valida a assinatura e as claims em toda rota protegida.
- **Segredos**: a chave privada fica no AWS Secrets Manager (apenas as duas
  Lambdas do `repo-auth-serverless` podem acessá-la); a chave pública fica no
  SSM Parameter Store (não sensível, qualquer verificador futuro pode lê-la
  sem acesso à chave privada).
- **Integração com a aplicação**: API Gateway → VPC Link → ALB interno
  (gerenciado pelo `repo-k8s-infra` via Kubernetes Ingress) → pods da
  aplicação no EKS. A aplicação também reverifica a assinatura RS256, o
  issuer e o audience em processo, via `JwtCustomerStrategy`, em vez de
  confiar apenas na decisão do Lambda Authorizer.

## Decisão sobre os papéis de staff

O `repo-auth-serverless` autentica apenas clientes por CPF; não existe Lambda
ou rota no Gateway para staff (`ADMIN`/`RECEPCIONISTA`/`MECANICO`). O PR #182
delimitou explicitamente o escopo da migração apenas ao fluxo de
cliente/CPF: o login e o cadastro de staff (`AuthService`, `JwtStrategy`,
HS256, `JWT_SECRET`) permanecem locais por enquanto. Esta é uma decisão
registrada, não um esquecimento — migrar a autenticação de staff para um
serviço externo é um desdobramento futuro, ainda sem escopo definido (exigiria
uma Lambda voltada a staff ou uma estratégia de centralização diferente).

## Alternativas consideradas

(Registradas na RFC-006)

- **Autorizador JWT nativo do API Gateway**: rejeitado — exigiria expor um
  endpoint JWKS público, uma infraestrutura permanente sem outro uso no
  projeto.
- **HS256 (assinatura simétrica)**: rejeitado — todo verificador futuro
  precisaria do mesmo segredo compartilhado, o que se encaixa pior em uma
  direção de microsserviços.
- **REST API + NLB** (em vez de HTTP API + VPC Link + ALB, registrado na
  RFC-003): rejeitado — mais caro, e o NLB opera apenas em L4, exigindo nova
  configuração de target group a cada futuro microsserviço.

## Consequências positivas

- A autenticação de clientes fica isolada do código de negócio — a aplicação
  NestJS não implementa mais a lógica de emissão de token para o cliente
  final.
- A chave privada nunca sai do `repo-auth-serverless`; qualquer verificador
  futuro (a própria aplicação, ou um futuro microsserviço) precisa apenas da
  chave pública, não sensível.
- O ALB/Ingress (em vez do NLB) permite adicionar roteamento por
  path/host para futuros microsserviços sem tocar no Gateway ou no VPC Link.

## Consequências negativas

- Novo ponto de falha distribuído: a indisponibilidade da Function Serverless
  bloqueia toda a autenticação de clientes (veja o fluxo alternativo em
  [authentication-flow.md](../architecture/authentication-flow.md)).
- Duas implementações de autenticação coexistem hoje: `src/auth/` (local,
  JWT+bcrypt, usuários de staff) e `repo-auth-serverless` (RS256, cliente
  final por CPF) — por decisão (veja acima), não por omissão.

## Riscos

- **Médio**: a `authenticate-customer` optou por consultar a instância RDS
  diretamente em vez de via RDS Proxy (veja RFC-006).
- **Baixo**: nenhuma rota da aplicação está protegida por `Role.CLIENTE`
  ainda; a infraestrutura do lado do consumidor (strategy + guard + role)
  está pronta, mas nenhum caso de uso de negócio hoje exige self-service do
  cliente, então isso é esperado, não uma lacuna.

## Referências

- RFC-003 (API Gateway/EKS) e RFC-006 (segredos/JWT) — veja
  [`docs/rfcs/README.md`](../rfcs/README.md)
- [Sequência de autenticação](../architecture/authentication-flow.md)
- `src/auth/` (implementação local atual de staff, `async-furious-project`)
- PR #182 (`feat/customer-jwt-rs256-auth`) — implementação do lado do
  consumidor
- `repo-auth-serverless` — implementação do lado do emissor
