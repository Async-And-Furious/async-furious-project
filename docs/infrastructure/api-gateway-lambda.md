# API Gateway e Lambda

> **[ATUAL]** A borda serverless está implementada e provisionada. Este
> documento descreve os recursos reais, o contrato do token e como a aplicação
> no EKS consome esse contrato.
>
> Fontes: `repo-auth-serverless@release/v0.1.0` (`infra/hml`, `infra/prod`,
> `src/`) e `src/auth/` deste repositório.
> Decisão em [ADR-0002](../adr/0002-autenticacao-centralizada-api-gateway-serverless.md);
> detalhes em [RFC-003](../rfcs/RFC-003-api-gateway-eks-integration.md) e
> [RFC-006](../rfcs/RFC-006-secrets-and-jwt.md).

## 1. Topologia

O API Gateway é o único ponto de entrada público do sistema. Nem o ALB, nem o
cluster, nem o banco são alcançáveis diretamente da internet.

```mermaid
flowchart LR
    client["Cliente HTTP"]

    subgraph GW["API Gateway HTTP API: tc3-auth-&lt;env&gt;"]
        rAuth["Rota POST /auth<br/>(pública)"]
        rProt["Rota ANY /{proxy+}<br/>(authorizer CUSTOM)"]
    end

    authFn["Lambda tc3-auth-&lt;env&gt;-auth<br/>authenticate-customer"]
    authzFn["Lambda tc3-auth-&lt;env&gt;-authorizer<br/>authorize-request"]
    sm[("Secrets Manager<br/>chave privada RS256")]
    ssm[("SSM Parameter Store<br/>chave pública RS256")]
    link["VPC Link"]
    alb["ALB interno tc3-&lt;env&gt;-internal"]
    pods["Pods NestJS no EKS"]
    rds[("RDS PostgreSQL")]

    client -->|HTTPS| rAuth
    client -->|"HTTPS + Bearer"| rProt
    rAuth -->|AWS_PROXY| authFn
    rProt -.->|"identity source:<br/>header Authorization"| authzFn
    authFn -->|GetSecretValue| sm
    authFn -->|"SELECT em Cliente"| rds
    authzFn -->|GetParameter| ssm
    rProt -->|"HTTP_PROXY"| link --> alb --> pods
    pods --> rds
```

## 2. Recursos provisionados

Um conjunto completo por ambiente, com `name_prefix` igual a `tc3-auth-hml` ou
`tc3-auth-prod`.

| Recurso Terraform | Nome | Papel |
|---|---|---|
| `aws_apigatewayv2_api.http` | `tc3-auth-<env>` | HTTP API v2 |
| `aws_apigatewayv2_stage.default` | `$default` | Stage com `auto_deploy = true` |
| `aws_lambda_function.auth` | `<prefix>-auth` | Emite o JWT a partir do CPF |
| `aws_lambda_function.authorizer` | `<prefix>-authorizer` | Lambda Authorizer das rotas protegidas |
| `aws_apigatewayv2_route.auth` | `POST /auth` | Rota pública, integração `AWS_PROXY` |
| `aws_apigatewayv2_route.protected` | `ANY /{proxy+}` | Rota protegida, integração `HTTP_PROXY` |
| `aws_apigatewayv2_authorizer.lambda` | `<prefix>-authorizer` | `REQUEST`, `enable_simple_responses = true`, identity source `$request.header.Authorization` |
| `aws_apigatewayv2_vpc_link.backend` | `<prefix>-backend` | Liga o API Gateway à VPC privada |
| `aws_cloudwatch_log_group` (x2) | `/aws/lambda/<prefix>-auth` e `-authorizer` | Logs, retenção de 30 dias |
| `aws_cloudwatch_metric_alarm` (x4) | erros das duas Lambdas, `5XXError` das duas rotas | Criados sem ação de notificação |

Ambas as funções rodam em `nodejs22.x` a partir do mesmo pacote `dist.zip`,
diferindo apenas no handler. A Lambda de autenticação tem `timeout = 10` e
entra na VPC (`vpc_config` com as subnets e o security group do banco) quando
`auth_lambda_vpc_enabled` está ligado, porque precisa consultar o RDS. O
authorizer não acessa banco e fica fora da VPC.

O `backend_integration_uri` é o ARN do **listener** do ALB interno, validado
por expressão regular no próprio Terraform. Quando `deploy_auth_only = true`,
a rota protegida, a integração e o VPC Link não são criados, o que permite
subir a autenticação antes de o cluster existir.

## 3. Contrato do token

O contrato é idêntico nos dois lados e travado por validação, não por
convenção.

| Campo | Valor | Onde é imposto |
|---|---|---|
| Algoritmo | `RS256` | `src/lib/jwt.ts` (constante) e `jwt.config.ts:38` no monólito |
| `iss` | `repo-auth-serverless` | `variable "jwt_issuer"` com `validation` que rejeita outro valor |
| `aud` | `async-furious-project` | `variable "jwt_audience"` com `validation` |
| `exp` | 1800 segundos (30 min) | `variable "jwt_expires_in"` com `validation`; o monólito exige o mesmo em produção |
| `sub` | `Cliente.id` | `signToken` rejeita `sub` vazio; o CPF nunca entra no token |

A chave privada RS256 fica no Secrets Manager e só a Lambda de autenticação a
lê. A chave pública fica no SSM Parameter Store e é lida por dois consumidores:
o authorizer, em tempo de execução, e o `deploy-eks.yml`, que a injeta no
Secret Kubernetes como `JWT_PUBLIC_KEY` e `JWT_CUSTOMER_PUBLIC_KEY`. Ambas as
chaves são cacheadas no contexto de execução da Lambda para evitar uma ida ao
Secrets Manager por invocação (`src/lib/keys.ts`).

## 4. Fluxo de autenticação

`POST /auth` com corpo `{ "cpf": "..." }`:

1. O handler normaliza o CPF, removendo pontuação, e valida os dois dígitos
   verificadores. Rejeita sequências de dígito único.
2. Consulta `SELECT "id", "ativo" FROM "Cliente" WHERE "documento" = $1 AND
   "tipo_documento" = 'CPF'`, com pool de no máximo 2 conexões, reaproveitado
   entre invocações.
3. Assina o JWT com `sub` igual ao `Cliente.id`.

| Situação | Resposta |
|---|---|
| Corpo não é JSON válido | `400 invalid_request` |
| `cpf` ausente ou não string | `400 invalid_request` |
| CPF com dígito verificador inválido | `401 unauthorized` |
| Cliente inexistente ou inativo | `401 unauthorized` |
| Sucesso | `200` com o token e o contrato explícito |

CPF malformado e cliente inexistente devolvem a mesma mensagem genérica, para
não permitir enumeração de clientes pela diferença de resposta.

## 5. Fluxo de autorização

O authorizer extrai o token do header `Authorization`, verifica assinatura,
`iss`, `aud` e `exp`, e responde no formato simples (`isAuthorized: true/false`).
Não há `403` distinto na borda: token ausente, malformado, expirado ou com
assinatura inválida produzem a mesma negativa.

Correlation ID atravessa toda a cadeia. O authorizer aceita um
`x-correlation-id` do cliente ou gera um a partir do `requestId`, devolve o
valor no contexto do authorizer, e a integração com o backend reescreve o
header com `"overwrite:header.x-correlation-id" = "$context.authorizer.correlation_id"`.
A aplicação no EKS recebe, portanto, um correlation ID já garantido.

Os logs das duas funções são JSON de uma linha com `level`, `event`,
`correlation_id` e `duration_ms`. Nenhum deles registra CPF ou token.

## 6. Como o monólito consome

A variável `AUTH_MODE` decide o comportamento. O `deploy-eks.yml` aplica
`AUTH_MODE=gateway` no ConfigMap em HML e PROD
(`.github/workflows/deploy-eks.yml:302,585`).

Com `AUTH_MODE=gateway`:

- `POST /auth/login` e `POST /auth/register` do NestJS passam a responder
  `401`, com a mensagem de que o fluxo local está indisponível
  (`src/auth/services/auth.service.ts:19,50`). A emissão de token deixa de
  existir dentro da aplicação.
- `resolveJwtContract` força `RS256` e valida o token contra `JWT_ISSUER`,
  `JWT_AUDIENCE` e `maxAge` equivalente ao `exp` de 1800 segundos.
- `JwtStrategy.validate` resolve o `sub` como `Cliente.id` via
  `validateCustomer`, que exige `ativo = true` no banco.

Ou seja, a validação acontece duas vezes por requisição protegida: uma na
borda, feita pelo authorizer, e outra dentro da aplicação, que revalida a
assinatura e reconfirma que o cliente continua ativo. A segunda camada existe
porque o token carrega identidade, não estado: um cliente desativado depois da
emissão continuaria passando pelo authorizer.

O smoke test do deploy confirma justamente essa proteção: chama
`/api/v1/health/live` pelo endpoint do gateway sem token e falha o pipeline se
a resposta não for `401` ou `403`
(`.github/workflows/deploy-eks.yml:753-761` para HML, `789-797` para PROD).

## 7. Pendências

- Papéis administrativos (`ADMIN`, `RECEPCIONISTA`, `MECANICO`) não têm fluxo
  na borda. `repo-auth-serverless` autentica apenas cliente por CPF, e com
  `AUTH_MODE=gateway` o login local está desligado. Não há RFC que resolva como
  um administrador se autentica em HML ou PROD.
- `validateCustomer` devolve `role: Role.RECEPCIONISTA` para um cliente
  autenticado por CPF (`src/auth/services/auth.service.ts`), enquanto
  `JwtCustomerStrategy` devolve `Role.CLIENTE` para o mesmo tipo de token.
  As duas estratégias atribuem papéis diferentes ao mesmo sujeito; qual delas
  atende cada rota protegida não está documentado em nenhuma RFC.
- Não há throttling nem WAF configurado no HTTP API. A rota `POST /auth` aceita
  tentativas sem limite de taxa, o que permite varredura de CPFs apesar da
  resposta genérica.
- Os alarmes CloudWatch existem, mas sem `alarm_actions`. Ninguém é notificado
  quando disparam. Ver [observability.md](./observability.md).
