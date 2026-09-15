# Sequência de Autenticação

> Notação de sequência UML (Mermaid `sequenceDiagram`). Existem dois tipos de
> usuário (staff e cliente) e dois modos de execução, decididos pela variável
> `AUTH_MODE`: `local` no cluster `kind`, `gateway` em `hml` e `prod`.
>
> Detalhamento da borda em
> [api-gateway-lambda.md](../infrastructure/api-gateway-lambda.md); decisão em
> [ADR-0002](../adr/0002-autenticacao-centralizada-api-gateway-serverless.md).

## 1. Staff no ambiente local (`AUTH_MODE=local`)

Evidência: `src/auth/guards/jwt-auth.guard.ts`, `src/auth/guards/roles.guard.ts`,
`src/auth/strategies/jwt.strategy.ts`, `src/auth/jwt.config.ts`.

```mermaid
sequenceDiagram
    actor U as Staff (Admin/Recepcionista/Mecânico)
    participant API as Aplicação NestJS
    participant Guard as JwtAuthGuard / RolesGuard
    participant DB as PostgreSQL

    U->>API: POST /api/v1/auth/login (email, senha)
    API->>DB: busca usuário por email
    DB-->>API: usuário (hash bcrypt)
    alt credenciais inválidas
        API-->>U: 401 Unauthorized
    else credenciais válidas
        API-->>U: 200 { access_token HS256, sub=User.id, email, role }
    end

    U->>API: rota protegida, Authorization Bearer
    API->>Guard: JwtAuthGuard.canActivate()
    alt rota @Public()
        Guard-->>API: libera sem checar token
    else token ausente, expirado ou inválido
        Guard-->>U: 401 Unauthorized
    else token válido
        Guard->>Guard: RolesGuard compara @Roles(...) com user.role
        alt papel sem permissão
            Guard-->>U: 403 Forbidden
        else papel autorizado
            API-->>U: 200 (resposta do caso de uso)
        end
    end
```

HS256 com `JWT_SECRET` só é aceito fora de produção: `resolveJwtContract`
recusa HS256 quando `NODE_ENV=production` e exige expiração de 1800 segundos.

## 2. Cliente nos ambientes AWS (`AUTH_MODE=gateway`)

Evidência: `repo-auth-serverless` (branch `main`), `src/auth/strategies/jwt.strategy.ts`,
`src/auth/services/auth.service.ts`.

```mermaid
sequenceDiagram
    actor C as Cliente
    participant GW as API Gateway (tc3-auth-env)
    participant AuthFn as Lambda authenticate-customer
    participant AuthzFn as Lambda authorize-request
    participant SM as Secrets Manager
    participant SSM as SSM Parameter Store
    participant RDS as RDS PostgreSQL
    participant App as Aplicação no EKS (via ALB)

    C->>GW: POST /auth { cpf }
    GW->>AuthFn: integração AWS_PROXY
    AuthFn->>AuthFn: normaliza CPF e valida dígitos verificadores
    alt corpo inválido ou cpf ausente
        AuthFn-->>C: 400 invalid_request
    else CPF com dígito inválido
        AuthFn-->>C: 401 unauthorized
    else CPF bem formado
        AuthFn->>RDS: SELECT id, ativo FROM Cliente WHERE documento e tipo CPF
        alt cliente inexistente ou inativo
            AuthFn-->>C: 401 unauthorized (mesma mensagem genérica)
        else cliente ativo
            AuthFn->>SM: GetSecretValue (chave privada RS256)
            AuthFn-->>C: 200 { token RS256, sub=Cliente.id, exp 1800s }
        end
    end

    C->>GW: ANY /{proxy+} com Authorization Bearer
    GW->>AuthzFn: authorizer REQUEST
    AuthzFn->>SSM: GetParameter (chave pública RS256)
    alt token ausente, malformado, expirado ou assinatura inválida
        AuthzFn-->>GW: isAuthorized=false
        GW-->>C: 401 ou 403
    else token válido
        AuthzFn-->>GW: isAuthorized=true, correlation_id
        GW->>App: HTTP_PROXY via VPC Link
        App->>App: JwtStrategy revalida RS256, issuer, audience e exp
        App->>RDS: token sem role: validateCustomer(sub) exige ativo=true
        alt cliente desativado após a emissão
            App-->>C: 401 Unauthorized
        else autorizado
            App-->>C: resposta do caso de uso
        end
    end
```

## 3. Staff nos ambientes AWS (`AUTH_MODE=gateway`)

O login de staff continua dentro da aplicação, mas passa a assinar em RS256
com a **mesma chave privada** da Lambda: o `deploy-eks.yml` busca o secret
apontado por `JWT_PRIVATE_KEY_SECRET_ARN` e o injeta como `JWT_PRIVATE_KEY`.
Por isso o authorizer aceita o token de staff sem distinção.

Como `POST /api/v1/auth/login` não tem rota pública no API Gateway (cai em
`ANY /{proxy+}`, que exige authorizer), o staff precisa de um token válido
para alcançar o login. É o que o `full-acceptance.yml` faz: pede um token de
cliente em `POST /auth` e o usa como `Bearer` na chamada de login.

```mermaid
sequenceDiagram
    actor S as Staff
    participant GW as API Gateway
    participant AuthzFn as Lambda authorize-request
    participant App as Aplicação no EKS
    participant RDS as RDS PostgreSQL

    S->>GW: POST /auth { cpf semeado }
    GW-->>S: token de cliente
    S->>GW: POST /api/v1/auth/login (email, senha) com Bearer do cliente
    GW->>AuthzFn: authorizer REQUEST
    AuthzFn-->>GW: isAuthorized=true
    GW->>App: HTTP_PROXY via VPC Link
    App->>RDS: busca User e compara bcrypt
    App-->>S: 200 { access_token RS256, sub=User.id, email, role }

    S->>GW: rota de staff com Bearer do staff
    GW->>AuthzFn: authorizer REQUEST
    AuthzFn-->>GW: isAuthorized=true
    GW->>App: HTTP_PROXY via VPC Link
    App->>App: JwtStrategy com role: validateTokenSubject busca User
    App->>App: RolesGuard compara @Roles(...) com role
    App-->>S: 200, 401 ou 403
```

## 4. Contraste

| Aspecto | Staff, local | Staff, AWS | Cliente, AWS |
|---|---|---|---|
| Quem emite | aplicação | aplicação | Lambda `authenticate-customer` |
| Credencial | e-mail e senha | e-mail e senha | CPF |
| Algoritmo | HS256 | RS256 (chave compartilhada com a Lambda) | RS256 |
| Claims | `sub`=`User.id`, `email`, `role` | idem | só `sub`=`Cliente.id` |
| Primeira barreira | `JwtAuthGuard` | Lambda Authorizer | Lambda Authorizer |
| Resolução na aplicação | `validateTokenSubject` | `validateTokenSubject` | `validateCustomer` |
| Expiração | 1800s | 1800s | 1800s |

`JwtCustomerStrategy` e `JwtCustomerAuthGuard` existem (PR #182) e
`Role.CLIENTE` está no enum de papéis, mas nenhuma rota fora de `src/auth/`
usa `JwtCustomerAuthGuard` ou `@Roles(Role.CLIENTE)` hoje. Os tokens de
cliente são resolvidos pela `JwtStrategy` padrão.

## 5. Pendências

- O login de staff na AWS depende de um token prévio para atravessar o
  authorizer. Não há rota pública de login de staff nem decisão registrada
  sobre esse encadeamento.
- A chave privada RS256 é compartilhada entre a Lambda e a aplicação, o que
  contradiz a premissa da RFC-006 de que ela nunca sai de
  `repo-auth-serverless`.
- `validateCustomer`, usado pela `JwtStrategy` para tokens sem `role`, atribui
  `Role.RECEPCIONISTA` ao cliente; `validateTokenSubject` e
  `JwtCustomerStrategy` atribuem `Role.CLIENTE`. Um token de cliente pode,
  portanto, satisfazer `@Roles(Role.RECEPCIONISTA)` nos ambientes AWS. Não
  verifiquei rota a rota se isso é explorável; merece revisão.
- A rota `POST /auth` não tem throttling nem WAF.
