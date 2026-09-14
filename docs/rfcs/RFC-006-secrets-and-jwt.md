# RFC-006: Estratégia de secrets e assinatura de JWT

## Status

Aceita — 2026-07-30

**Fonte da verdade**: este arquivo. Uma cópia existe em
`repo-auth-serverless` para visibilidade local já que ele implementa esta
RFC — atualizar aqui primeiro, depois sincronizar.

## Contexto

A lista de decisões do HANDOFF.md (§20) deixa três itens relacionados em
aberto:

- #2 — Lambda Authorizer vs. authorizer nativo de JWT.
- #7 — assinatura do JWT: simétrica vs. assimétrica.
- #8 — duração do token e claims.

Os dois handlers Lambda do `repo-auth-serverless`
(`authenticate-customer`, `authorize-request`) ainda são stubs `501`/
`isAuthorized: false` pendentes desta decisão. O módulo RDS do
`repo-db-infra` também deixou "como a Lambda se autentica para ler
secrets em runtime" para esta RFC.

Isso também precisa levar em conta a mesma restrição de longo prazo da
RFC-003: o monólito no `repo-application` eventualmente vai se dividir em
microsserviços, e qualquer serviço futuro vai precisar verificar de forma
independente os JWTs emitidos pelo `repo-auth-serverless`.

## Decisão

**Authorizer: Lambda Authorizer customizado**, não o authorizer nativo de
JWT do API Gateway. O authorizer nativo de JWT exige um endpoint HTTPS
público de JWKS para o issuer — infraestrutura permanente extra sem
nenhum outro uso neste projeto. Um Lambda Authorizer também combina com o
desenho de dois handlers que o HANDOFF §4.3 já sugere
(`authenticate-customer` / `authorize-request`) e mantém controle total
sobre a validação de claims customizadas.

**Assinatura: RS256 (assimétrica)**, não HS256. Justificativa:

- A chave privada nunca sai do `repo-auth-serverless`. Apenas suas duas
  Lambdas recebem `secretsmanager:GetSecretValue` no único secret que a
  guarda.
- A chave pública não é sensível. Ela fica no SSM Parameter Store como um
  `String` simples (não `SecureString`), então qualquer verificador — hoje
  a Lambda `authorize-request`, amanhã o `repo-application` fazendo sua
  própria verificação independente de claims, ou um futuro microsserviço —
  só precisa de acesso de leitura a um parâmetro não secreto. Sem
  compartilhamento de secret entre repositórios, sem concessões de IAM
  sobre a chave de assinatura de fato fora do `repo-auth-serverless`.
- Com HS256, todo verificador precisaria do mesmo secret compartilhado, o
  que fica mais difícil de escopar corretamente à medida que mais serviços
  precisam verificar tokens.

**Token**: expiração de 30 minutos, claims mínimas — `sub` (id do
cliente), `iat`, `exp`, `iss` (`repo-auth-serverless`). Sem CPF puro no
payload.

## Armazenamento das chaves

- Chave privada: AWS Secrets Manager, um único secret, referenciado por
  ARN via uma variável de ambiente da Lambda (nunca o material da chave em
  si).
- Chave pública: SSM Parameter Store, um único parâmetro `String`,
  referenciado por nome via uma variável de ambiente da Lambda.
- Ambas são provisionadas uma única vez fora da esteira normal (geradas
  via `openssl`, armazenadas por quem tem acesso IAM) — não são geradas
  nem commitadas pelo código da aplicação ou pelo state do Terraform.

## Consequências

- A `authorize-request` busca a chave pública no SSM e verifica
  assinaturas RS256 — sem dependência do `repo-db-infra` ou de qualquer
  outro repositório.
- A etapa de *emissão* do JWT da `authenticate-customer` (quando
  implementada) busca a chave privada no Secrets Manager e assina com
  RS256.
- A parte de validação de CPF contra o registro do cliente na
  `authenticate-customer` está explicitamente fora do escopo desta RFC —
  depende da decisão #11 do HANDOFF.md (Lambda direto ao RDS vs. RDS
  Proxy) e do contrato de dados do cliente, ambos ainda em aberto.
- Resolve as decisões #2, #7 e #8 do HANDOFF.md.

## Alternativas consideradas

- **HS256 + Lambda Authorizer**: mais simples (um único secret, sem par de
  chaves), mas todo verificador futuro precisaria do mesmo secret
  compartilhado — pior encaixe para a direção de microsserviços.
- **Authorizer nativo de JWT (RS256 + endpoint JWKS)**: evita escrever
  código de authorizer, mas exige levantar e manter um endpoint JWKS
  público sem nenhum outro benefício nesta escala.
