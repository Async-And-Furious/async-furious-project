# Diagrama de Componentes

> Convenção C4 (nível Component), em Mermaid. Todos os componentes abaixo estão
> implementados. Borda tracejada indica o que continua pendente de decisão.

```mermaid
flowchart TB
    subgraph Atores
        userAdmin["Recepcionista / Mecânico / Admin"]
        userCustomer["Cliente final (sem conta)"]
    end

    subgraph RepoAuth["repo-auth-serverless"]
        gateway["API Gateway HTTP API"]
        lambdaAuth["Lambda: authenticate-customer"]
        lambdaAuthz["Lambda: authorize-request"]
    end

    subgraph RepoApp["async-furious-project"]
        subgraph Presentation["presentation"]
            controllers["Controllers REST<br/>(cadastro, ordem-servico, pecas-insumos, financeiro, auth, health)"]
        end
        subgraph Application["application"]
            usecases["Use Cases"]
        end
        subgraph Domain["domain"]
            entities["Entidades / Value Objects / DomainEvent"]
        end
        subgraph Infrastructure["infrastructure"]
            repos["Repositórios Prisma"]
            eventEmitter["EmissorEventos"]
            authLocal["AuthModule<br/>guards, estratégias, contrato JWT"]
        end
        controllers --> usecases --> entities
        repos -.implementa contratos.-> entities
        usecases --> repos
        usecases --> eventEmitter
        controllers --> authLocal
    end

    subgraph RepoDb["repo-db-infra"]
        rds[("RDS PostgreSQL 16.4")]
    end

    subgraph RepoK8s["repo-k8s-infra"]
        alb["ALB interno + target group"]
        eks["EKS + ECR"]
    end

    obs["Observabilidade<br/>parcial, sem stack decidida"]

    userCustomer --> gateway
    userAdmin -.->|"[PENDENTE]"| gateway
    gateway --> lambdaAuth
    gateway -. authorizer .-> lambdaAuthz
    gateway -->|VPC Link| alb --> eks
    eks --> controllers
    repos -->|Prisma| rds
    lambdaAuth -->|consulta Cliente| rds
    authLocal -.revalida o token da borda.-> lambdaAuthz

    style obs stroke-dasharray: 4 4
```

## Tabela de componentes

| Componente | Repositório | Responsabilidade | Tecnologia | Comunica-se com |
|---|---|---|---|---|
| API Gateway | `repo-auth-serverless` | Ponto de entrada único; `POST /auth` público e `ANY /{proxy+}` protegido | AWS API Gateway HTTP API v2, stage `$default` com auto deploy | Ambas as Lambdas e o ALB interno via VPC Link |
| `authenticate-customer` | `repo-auth-serverless` | Valida dígitos do CPF, confirma cliente ativo, emite JWT | AWS Lambda `nodejs22.x`, RS256, dentro da VPC | Secrets Manager (chave privada) e RDS por conexão direta com pool de até 2 conexões |
| `authorize-request` | `repo-auth-serverless` | Lambda Authorizer: valida assinatura, emissor, audiência e expiração | AWS Lambda `nodejs22.x`, `enable_simple_responses` | SSM Parameter Store (chave pública) |
| ALB interno e target group | `repo-k8s-infra` | Alvo privado do VPC Link; entrega aos pods registrados por IP | ALB `internal`, listener HTTP 80, `targetType: ip` | Cluster EKS, via `TargetGroupBinding` |
| Cluster EKS, VPC e ECR | `repo-k8s-infra` | Orquestração dos workloads, posse da rede e registry de imagens | Terraform, EKS 1.30, nós `t3.medium`, ECR com tag imutável | `repo-db-infra`, que lê seus outputs pelo estado remoto |
| Aplicação NestJS | `async-furious-project` | Quatro Bounded Contexts de negócio mais o módulo transversal `auth` | NestJS, TypeScript, Prisma, Clean Architecture e DDD | RDS por Prisma; confia no JWT da borda quando `AUTH_MODE=gateway` |
| RDS PostgreSQL | `repo-db-infra` | Banco gerenciado | Amazon RDS, PostgreSQL 16.4, TLS obrigatório, Multi-AZ apenas em produção | Aplicação e Lambda de autenticação; credenciais por master password gerenciada no Secrets Manager |
| Observabilidade | vários | Logs, métricas e tracing centralizados | **[PENDENTE]** Existem logs estruturados e alarmes CloudWatch sem destino; nenhuma stack decidida ([ADR-0005](../adr/0005-observabilidade.md)) | Todos os componentes acima |

## O que aconteceu com o AuthModule local

Versões anteriores deste documento registravam como pendência se o
`AuthModule` seria removido, mantido como segunda camada ou adaptado. O código
respondeu: ele foi **mantido como segunda camada de validação**, e a variável
`AUTH_MODE` decide seu comportamento.

| `AUTH_MODE` | O que o `AuthModule` faz |
|---|---|
| `local` | Emite e valida o token. Login por e-mail e senha, HS256, recusado em produção por `resolveJwtContract` |
| `gateway` | Não emite nada. `login` e `register` respondem `401`, e o módulo se limita a revalidar o token RS256 da borda e reconfirmar que o cliente está ativo |

A extração para `repo-auth-serverless` foi da **emissão** do token, não da
verificação. A verificação passou a acontecer duas vezes por requisição
protegida, na borda e na aplicação, porque o token carrega identidade e não
estado. Ver
[authentication-flow.md](./authentication-flow.md) e
[ADR-0002](../adr/0002-autenticacao-centralizada-api-gateway-serverless.md).

Segue pendente o caminho de autenticação dos papéis administrativos nos
ambientes AWS: com `AUTH_MODE=gateway`, só o cliente autentica, por CPF.
