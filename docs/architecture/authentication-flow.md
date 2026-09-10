# Sequência de Autenticação

> Notação UML de sequência (Mermaid `sequenceDiagram`). Existem dois fluxos, e
> qual deles vale depende da variável `AUTH_MODE`: `local` no ambiente `kind`,
> `gateway` em `hml` e `prod`.
>
> Detalhamento da borda em
> [api-gateway-lambda.md](../infrastructure/api-gateway-lambda.md); decisão em
> [ADR-0002](../adr/0002-autenticacao-centralizada-api-gateway-serverless.md).

## 1. `AUTH_MODE=local` (ambiente `kind`)

Usuário administrativo autentica com e-mail e senha dentro do próprio NestJS.

Evidência: `src/auth/guards/jwt-auth.guard.ts`, `src/auth/guards/roles.guard.ts`,
`src/auth/strategies/jwt.strategy.ts`, `src/auth/decorators/public.decorator.ts`.

```mermaid
sequenceDiagram
    actor U as Usuário (Admin/Recepcionista/Mecânico)
    participant API as Aplicação NestJS
    participant Guard as JwtAuthGuard / RolesGuard
    participant DB as PostgreSQL

    U->>API: POST /api/v1/auth/login (email, senha)
    API->>DB: busca usuário por email
    DB-->>API: usuário (hash bcrypt)
    alt credenciais inválidas
        API-->>U: 401 Unauthorized
    else credenciais válidas
        API-->>U: 200 { access_token JWT }
    end

    U->>API: rota protegida, Authorization Bearer
    API->>Guard: JwtAuthGuard.canActivate()
    Guard->>Guard: verifica @Public() via Reflector
    alt rota marcada @Public()
        Guard-->>API: libera sem checar token
    else token ausente
        Guard-->>U: 401 Unauthorized
    else token presente
        Guard->>Guard: valida assinatura e expiração (passport-jwt)
        alt token expirado ou inválido
            Guard-->>U: 401 Unauthorized
        else token válido
            Guard->>Guard: RolesGuard compara @Roles(...) com user.role
            alt papel sem permissão
                Guard-->>U: 403 Forbidden
            else papel autorizado
                Guard-->>API: prossegue para o controller
                API-->>U: 200 (resposta do caso de uso)
            end
        end
    end
```

Neste modo o algoritmo é HS256 por padrão, com `JWT_SECRET` compartilhado.
`resolveJwtContract` recusa HS256 quando `NODE_ENV=production`
(`src/auth/jwt.config.ts:38`), então esse caminho é restrito a
desenvolvimento e teste.

## 2. `AUTH_MODE=gateway` (ambientes AWS)

Cliente autentica por CPF na borda. O monólito deixa de emitir token: `login`
e `register` respondem `401` neste modo
(`src/auth/services/auth.service.ts:19,50`).

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
            AuthFn->>AuthFn: assina JWT sub=Cliente.id, exp 1800s
            AuthFn-->>C: 200 { token, contrato }
        end
    end

    C->>GW: ANY /{proxy+} com Authorization Bearer
    GW->>AuthzFn: authorizer REQUEST (identity source: header Authorization)
    AuthzFn->>SSM: GetParameter (chave pública RS256)
    alt token ausente, malformado, expirado ou assinatura inválida
        AuthzFn-->>GW: isAuthorized=false
        GW-->>C: 401 Unauthorized
    else token válido
        AuthzFn-->>GW: isAuthorized=true, context.correlation_id
        GW->>App: HTTP_PROXY via VPC Link, header x-correlation-id reescrito
        App->>App: JwtStrategy revalida RS256, issuer, audience e exp
        App->>RDS: validateCustomer(sub) exige ativo=true
        alt cliente desativado após a emissão do token
            App-->>C: 401 Unauthorized
        else autorizado
            App-->>C: 200 (resposta do caso de uso)
        end
    end
```

### Por que a validação acontece duas vezes

O authorizer prova que o token é autêntico e não expirou. Ele não prova que o
cliente ainda está ativo, porque o token carrega identidade, não estado. Um
cliente desativado logo depois da emissão continuaria passando pela borda por
até 30 minutos. Por isso a aplicação revalida a assinatura e reconsulta o
banco a cada requisição.

O smoke test do deploy verifica exatamente a primeira camada: chama
`/api/v1/health/live` pelo gateway sem token e falha o pipeline se a resposta
não for `401` ou `403`.

## 3. Contraste entre os dois modos

| Aspecto | `AUTH_MODE=local` | `AUTH_MODE=gateway` |
|---|---|---|
| Onde autentica | dentro do processo NestJS | Lambda em `repo-auth-serverless` |
| Identificação | e-mail e senha (usuário administrativo) | CPF (cliente) |
| Algoritmo | HS256 (proibido em produção) | RS256, chave privada nunca sai da Lambda |
| `sub` | `User.id` | `Cliente.id` |
| Expiração | `JWT_EXPIRES_IN`, 1800s por padrão | 1800s, travado por validação no Terraform |
| Primeira barreira | `JwtAuthGuard` | Lambda Authorizer, antes de a requisição entrar na VPC |
| `login` e `register` | disponíveis | respondem 401 |

## 4. Pendências

- Não há fluxo de autenticação para os papéis administrativos (`ADMIN`,
  `RECEPCIONISTA`, `MECANICO`) nos ambientes AWS. A borda só autentica cliente
  por CPF e o login local está desligado. Nenhuma RFC resolve isso.
- `validateCustomer` atribui `Role.RECEPCIONISTA` a um cliente autenticado por
  CPF, enquanto `JwtCustomerStrategy` atribui `Role.CLIENTE` ao mesmo tipo de
  token. Qual estratégia atende cada rota protegida não está documentado.
- A rota `POST /auth` não tem throttling nem WAF.
