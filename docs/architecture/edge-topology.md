# Topologia de Infraestrutura e Borda (Fase 4)

> Desenho-alvo da Fase 4, decidido na [ADR-0021](../adr/0021-borda-sem-bff.md).
> O que está implantado hoje (um único serviço atrás do ALB) está em
> [deployment-diagram.md](./deployment-diagram.md). Este documento descreve o
> alvo; a implementação é escopo dos Epics de Plataforma e de cada serviço.

## 1. Diagrama

```mermaid
flowchart TB
    client["Cliente HTTP"]

    subgraph AWS["AWS, ambiente hml (único na Fase 4)"]
        subgraph Edge["repo-auth-serverless"]
            apigw["API Gateway HTTP API<br/>tc3-auth-hml"]
            authFn["Lambda authenticate-customer"]
            authzFn["Lambda authorize-request<br/>(Lambda Authorizer)"]
        end

        subgraph VPC["VPC tc3-vpc-hml, dona: repo-k8s-infra"]
            link["VPC Link"]
            alb["ALB interno<br/>regras por path"]
            subgraph EKS["EKS compartilhado, NetworkPolicy: só o ALB alcança os pods"]
                subgraph nsOs["namespace OS Service"]
                    os["Pods OS Service"]
                end
                subgraph nsBill["namespace Billing Service"]
                    bill["Pods Billing Service"]
                end
                subgraph nsExec["namespace Execução e Produção"]
                    exec["Pods Execução e Produção"]
                end
                kafka["Kafka (KRaft)"]
            end
            rds[("RDS PostgreSQL compartilhado<br/>um banco e credencial por serviço")]
        end
        ddb[("DynamoDB<br/>read model do OS Service")]
    end

    client -->|"POST /auth"| apigw
    apigw -->|AWS_PROXY| authFn
    client -->|"Bearer, /os /billing /execucao"| apigw
    apigw -.->|authorizer REQUEST| authzFn
    apigw -->|HTTP_PROXY| link --> alb
    alb -->|"/os/*"| os
    alb -->|"/billing/*"| bill
    alb -->|"/execucao/*"| exec
    os --> rds
    bill --> rds
    exec --> rds
    os --> ddb
    os <--> kafka
    bill <--> kafka
    exec <--> kafka
```

Não há BFF: o API Gateway fala direto com o ALB, e o ALB com cada serviço.

## 2. Mapa de roteamento

| Path no API Gateway | Autenticação | Destino | Observação |
|---|---|---|---|
| `POST /auth` | pública | Lambda `authenticate-customer` | inalterada da Fase 3 |
| `ANY /os/{proxy+}` | Lambda Authorizer | OS Service | |
| `ANY /billing/{proxy+}` | Lambda Authorizer | Billing Service | |
| `ANY /execucao/{proxy+}` | Lambda Authorizer | Execução e Produção | |

Consequências para a implementação (Epic de Plataforma):

- **Um destino por path no ALB.** Hoje há um único target group
  (`tc3-<env>-app`); são necessários três, um por serviço, com regras de
  listener por prefixo de path, cada um com seu `TargetGroupBinding`.
- **Prefixo de path.** A aplicação hoje serve em `/api/v1/...`
  (`setGlobalPrefix('api/v1')` em `src/main.ts`). Ou o Gateway remove o prefixo
  (`/os`) antes de encaminhar, ou cada serviço incorpora o prefixo no seu prefixo
  global. A escolha é detalhe de implementação e deve ser feita uma vez, igual
  para os três serviços.
- **Rotas públicas novas** (aprovação de orçamento, webhook do Mercado Pago)
  exigem rota sem authorizer explícita no Gateway; hoje só `POST /auth` é
  pública. Ver pendências na ADR-0021.

## 3. Network policy (requisito)

- Os pods dos três serviços só aceitam tráfego de entrada originado no ALB
  interno. Acesso direto ao pod, inclusive vindo de pod de outro serviço do
  cluster, é bloqueado.
- O tráfego de Kafka e de saída (RDS, DynamoDB, Mercado Pago) não é coberto por
  esta política de entrada; egress fica para o card de implementação decidir.
- **Pré-requisito técnico:** o CNI do EKS precisa impor `NetworkPolicy`. A
  implementação deve demonstrar o bloqueio com um teste (requisição direta ao
  pod falha; via ALB passa).
- Implementação em `repo-k8s-infra` / manifests de cada serviço: fora do escopo
  da Feature #311.

## 4. Bypass de autenticação para desenvolvimento local

Como o serviço não valida token, o "bypass" precisa de um critério para o que
cada serviço assume como identidade quando roda fora da borda. Especificação:

- **Mecanismo**: variável `AUTH_BYPASS=true`. Com ela, o serviço não exige
  `Authorization` e aceita a identidade de teste vinda de variáveis de ambiente
  (`AUTH_BYPASS_SUB`, `AUTH_BYPASS_ROLE`) em vez de claims do token.
- **Critério de ativação**: somente com `NODE_ENV` diferente de `production`.
  No boot, se `AUTH_BYPASS=true` e `NODE_ENV=production`, o processo **aborta**
  (mesmo padrão de `resolveJwtContract`, que recusa HS256 em produção). Os
  manifests de HML nunca definem `AUTH_BYPASS`.
- **Escopo**: `pnpm run dev` e cluster `kind` local (`scripts/local-up.sh`), onde
  não existe API Gateway. Em `kind`, `AUTH_MODE=local` da Fase 3 é o precedente
  que este mecanismo substitui para os serviços novos.
- **Teste**: um teste por serviço garantindo que o boot falha com
  `AUTH_BYPASS=true` e `NODE_ENV=production`.

## 5. Ambientes

A Fase 4 é **HML-only**. Não haverá PROD dos serviços novos nem workflow de
deploy para PROD na Fase 4; o PROD da Fase 3 (monólito) não é alterado por esta
decisão.

## 6. Cluster e banco compartilhados

Um único cluster EKS e uma única instância RDS por ambiente atendem aos três
serviços, em namespaces/deployments e bancos/credenciais separados. A
justificativa por escrito, com o trade-off de ponto único de falha, está na
[ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md). O
dimensionamento de nós e a capacidade (em especial o Kafka) são escopo do Epic
de Plataforma.
