# ADR-0008: Autenticação e autorização locais — JWT + bcrypt + RBAC via guards

## Status

Aceita

## Contexto

O enunciado da Fase 1 exigia "autenticação JWT para APIs administrativas".
A solução precisava de três papéis de usuário administrativo com
permissões distintas (`ADMIN`, `RECEPCIONISTA`, `MECANICO`), e o cliente
final (sem conta no sistema) precisava aprovar/recusar orçamentos sem se
autenticar. Note que esta é a implementação **local, dentro do monólito**,
adotada na Fase 1 e mantida na Fase 2 — distinta da proposta de
autenticação centralizada via API Gateway/Function Serverless da Fase 3,
registrada em [ADR-0002](./0002-autenticacao-centralizada-api-gateway-serverless.md).

## Decisão

- **Autenticação**: JWT via `@nestjs/jwt` + `@nestjs/passport`
  (`JwtStrategy`, `src/auth/strategies/jwt.strategy.ts`), senha com hash
  `bcrypt`. Token expira em 1 hora.
- **Autorização**: RBAC (Role-Based Access Control) via `RolesGuard`
  (`src/auth/guards/roles.guard.ts`) checando `@Roles(...)` contra o papel
  do usuário autenticado.
- **Rotas públicas**: decorator `@Public()` (`src/auth/decorators/public.decorator.ts`)
  para rotas que o `JwtAuthGuard` deve pular (ex.: aprovação de orçamento
  pelo cliente final — ver [ADR-0011](./0011-aprovacao-orcamento-api-publica.md)).
- **Isolamento do domínio**: o Context Map (`docs/context-map/suggestions/context-map.suggestion.vic.mmd`)
  já registra a relação entre o contexto de Segurança e o de OS como
  **ACL (Anti-Corruption Layer)** — autenticação não vaza conceitos para
  dentro do domínio de negócio.

## Alternativas consideradas

Nenhuma alternativa (ex.: sessions, OAuth de terceiros, Passport com outra
estratégia) está documentada com comparativo — JWT era exigência do
enunciado, o restante (bcrypt, RBAC via guards) é implementação direta
dentro dessa exigência.

## Consequências positivas

- Modelo stateless simples e padrão de mercado, adequado para uma API
  administrativa sem necessidade de sessão persistida no servidor.
- RBAC via guards é declarativo (`@Roles('admin')`) e centralizado — regra
  de autorização não se espalha pelos controllers.
- ACL no Context Map mantém o domínio de negócio livre de conceitos de auth
  (token, claims), facilitando a futura extração para
  `repo-auth-serverless` sem refatorar o domínio.

## Consequências negativas

- Não há rotação de token/refresh token — expiração fixa de 1h força
  reautenticação completa.
- Duas implementações de autenticação hoje convivem na base de código
  (esta local + a proposta serverless da Fase 3), sem decisão de como/se
  unificam — já registrado como risco no ADR-0002.

## Riscos

- **Baixo**: algoritmo de assinatura JWT (`@nestjs/jwt`, presumivelmente
  HS256 por padrão) não foi confirmado explicitamente no código lido nesta
  auditoria — `TODO` verificar configuração exata de `JwtModule.register()`
  se isso vier a importar para alguma decisão futura.

## Referências

- `src/auth/guards/jwt-auth.guard.ts`, `src/auth/guards/roles.guard.ts`,
  `src/auth/strategies/jwt.strategy.ts`, `src/auth/decorators/public.decorator.ts`
- `README.md` (seção "Autenticacao e Papeis")
- `docs/context-map/suggestions/context-map.suggestion.vic.mmd`
- `docs/contexto-tecnico-consolidado.md` §8
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #5)
