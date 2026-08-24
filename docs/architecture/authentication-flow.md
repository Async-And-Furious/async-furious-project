# Sequência de Autenticação

> Notação UML de sequência (Mermaid `sequenceDiagram`). Este fluxo **nunca foi
> diagramado** em `docs/` antes desta auditoria (confirmado por busca em todo
> o repositório) — reconstruído a partir do código (`src/auth/`, `src/main.ts`)
> para o estado atual, e das RFCs aceitas para a proposta Fase 3.

## 1. [ATUAL] — autenticação local dentro do monólito

Evidência: `src/auth/guards/jwt-auth.guard.ts`, `src/auth/guards/roles.guard.ts`,
`src/auth/strategies/jwt.strategy.ts`, `src/auth/decorators/public.decorator.ts`,
README.md (expiração de 1h, papéis `ADMIN`/`RECEPCIONISTA`/`MECANICO`).

```mermaid
sequenceDiagram
    actor U as Usuário (Admin/Recepcionista/Mecânico)
    participant API as Aplicação NestJS (async-furious-project)
    participant Guard as JwtAuthGuard / RolesGuard
    participant DB as PostgreSQL

    U->>API: POST /api/v1/auth/login (email, senha)
    API->>DB: busca usuário por email
    DB-->>API: usuário (hash bcrypt)
    alt credenciais inválidas
        API-->>U: 401 Unauthorized
    else credenciais válidas
        API-->>U: 200 { access_token JWT, expira em 1h }
    end

    U->>API: requisição a rota protegida<br/>Authorization: Bearer <token>
    API->>Guard: JwtAuthGuard.canActivate()
    Guard->>Guard: verifica @Public() via Reflector
    alt rota marcada @Public()
        Guard-->>API: libera sem checar token
    else token ausente
        Guard-->>U: 401 Unauthorized
    else token presente
        Guard->>Guard: valida assinatura + expiração (passport-jwt)
        alt token expirado ou inválido
            Guard-->>U: 401 Unauthorized
        else token válido
            Guard->>Guard: RolesGuard checa @Roles(...) vs user.role
            alt papel sem permissão
                Guard-->>U: 403 Forbidden
            else papel autorizado
                Guard-->>API: prossegue para o controller
                API-->>U: 200 (resposta do caso de uso)
            end
        end
    end
```

**Observação**: hoje não existe nenhum envio de log/métrica/trace para uma
ferramenta de observabilidade neste fluxo — apenas o retorno HTTP (ver
[`docs/infrastructure/observability.md`](../infrastructure/observability.md)).

## 2. [PROPOSTA FASE 3] — autenticação centralizada via API Gateway + Function Serverless

Evidência: RFC-003 (trigo),
RFC-006 (trigo). **Os dois handlers Lambda são
esqueletos (`501`/`isAuthorized: false`) — este fluxo ainda não está
implementado, apenas decidido.**

```mermaid
sequenceDiagram
    actor C as Cliente / Usuário
    participant GW as API Gateway (repo-auth-serverless)
    participant AuthFn as Lambda: authenticate-customer
    participant AuthzFn as Lambda: authorize-request (Authorizer)
    participant Secrets as Secrets Manager
    participant SSM as SSM Parameter Store
    participant App as Aplicação (EKS, via ALB)
    participant Obs as Observabilidade [PENDENTE]

    C->>GW: POST /auth (CPF)
    GW->>AuthFn: invoca authenticate-customer
    AuthFn->>Secrets: lê chave privada RS256
    alt CPF inválido / cliente não encontrado
        AuthFn-->>GW: erro de validação
        GW-->>C: 401/400
    else CPF válido
        AuthFn->>AuthFn: assina JWT RS256 (sub=id cliente, iat, exp 30min, iss=repo-auth-serverless)
        AuthFn-->>GW: JWT
        GW-->>C: 200 { token }
    end

    C->>GW: requisição a rota protegida<br/>Authorization: Bearer <token>
    GW->>AuthzFn: invoca authorize-request (Lambda Authorizer)
    AuthzFn->>SSM: lê chave pública RS256
    alt token ausente
        AuthzFn-->>GW: isAuthorized=false
        GW-->>C: 401 Unauthorized
    else token expirado
        AuthzFn-->>GW: isAuthorized=false
        GW-->>C: 401 Unauthorized (token expirado)
    else token com assinatura inválida
        AuthzFn-->>GW: isAuthorized=false
        GW-->>C: 401 Unauthorized (assinatura inválida)
    else Function indisponível (timeout/erro Lambda)
        AuthzFn-->>GW: erro/timeout
        GW-->>C: 5xx
    else token válido
        AuthzFn-->>GW: isAuthorized=true, contexto (claims)
        GW->>App: encaminha via VPC Link → ALB
        alt claim sem permissão para o recurso
            App-->>C: 403 Forbidden
        else autorizado
            App-->>C: 200 (resposta do caso de uso)
        end
    end

    par Observabilidade [PENDENTE — sem ferramenta decidida]
        GW-->>Obs: [PENDENTE]
        AuthFn-->>Obs: [PENDENTE]
        AuthzFn-->>Obs: [PENDENTE]
        App-->>Obs: [PENDENTE]
    end
```

### Diferenças-chave entre o fluxo atual e a proposta

| Aspecto | [ATUAL] | [PROPOSTA FASE 3] |
|---|---|---|
| Onde a autenticação acontece | Dentro do processo NestJS (`src/auth/`) | Em `repo-auth-serverless`, fora do processo da aplicação |
| Identificação | Email + senha (usuário administrativo) | CPF do cliente (RFC-006 (trigo)) — **`TODO`**: como/se os papéis `ADMIN`/`RECEPCIONISTA`/`MECANICO` (usuários administrativos) migram para este fluxo não está definido em nenhuma RFC encontrada; RFC-006 fala apenas de "customer" |
| Algoritmo de assinatura | `@nestjs/jwt` (HS256 por padrão, não confirmado explicitamente no código lido) | RS256, chave privada nunca sai de `repo-auth-serverless` |
| Validação nas rotas | `JwtAuthGuard` + `passport-jwt` dentro do próprio NestJS | Lambda Authorizer na borda, antes de chegar à aplicação |
| Expiração | 1 hora (README) | 30 minutos (RFC-006) |

**Pendência registrada**: nenhuma RFC ou ADR encontrada resolve como os
três papéis administrativos (`ADMIN`, `RECEPCIONISTA`, `MECANICO`) se
relacionam com o novo fluxo de `repo-auth-serverless`, que fala apenas de
"customer" (cliente final). Ver [ADR-0002](../adr/0002-autenticacao-centralizada-api-gateway-serverless.md).
