# ADR-0021: Borda sem BFF — Authorizer na borda, validação local nos serviços e roteamento direto por path

## Status

Aceita

## Contexto

Com a divisão em três serviços (ADR-0017: OS Service, Billing Service,
Execução e Produção), é preciso decidir quem autentica a requisição e como o
tráfego chega a cada serviço. Hoje coexistem duas camadas de autenticação:

- o Lambda Authorizer de `repo-auth-serverless`
  ([ADR-0002](./0002-autenticacao-centralizada-api-gateway-serverless.md)),
  já implementado e testado na Fase 3, que valida assinatura, emissor,
  audiência e expiração do token RS256 na borda;
- o JWT local dentro do monólito (`src/auth/`,
  [ADR-0008](./0008-autenticacao-local-jwt-rbac.md)), que revalida o token e
  aplica o RBAC por papel (ver `docs/architecture/authentication-flow.md`).

O enunciado da Fase 4 não trata de autenticação nem de gateway ou BFF; só exige
repositório próprio por serviço e deploy automatizado em Kubernetes (p.5). A
decisão é, portanto, do grupo (F5/5.1 e 5.2 do `fase4-decisoes-epico1.md`,
fechadas em 21/09/2026).

A #311 partiu de "autenticação 100% na borda, com network policy". O Epic #312
(Feature #313) fechou depois em **não implementar `NetworkPolicy`**: o grupo
optou por não gastar um card nisso. Sem isolamento de rede, confiar apenas na
borda deixaria qualquer pod alcançável diretamente sem autenticação. Esta ADR
registra o desenho resultante, já refletido nas Features #317, #319, #323 e
#332.

O projeto também não tem frontend no escopo da Fase 4 (o `async-furious-front`
não faz parte da entrega), o que elimina o consumidor típico de um BFF.

## Decisão

1. **Autenticação em duas camadas.**
   - **Borda**: o Lambda Authorizer (`authorize-request`) continua sendo a
     primeira camada e valida o token. É reaproveitado como está, sem reescrita
     e sem propagar `sub`/`role` por header.
   - **Serviços**: cada serviço valida o JWT localmente (segunda camada), com
     `src/auth/` **copiado** do OS Service (`jwt.strategy.ts`, `JwtAuthGuard`,
     `RolesGuard` e o enum de papéis). Reuso direto, sem pacote npm
     compartilhado.
2. **RBAC permanece local.** O papel (`ADMIN`, `RECEPCIONISTA`, `MECANICO`) e o
   `sub` saem do token validado dentro de cada serviço. Nenhum serviço depende
   de o Gateway injetar claims.
3. **Login de staff e `User` permanecem no OS Service.** `POST /api/v1/auth/login`
   continua emitido pela aplicação com a chave privada já usada hoje; não há
   decisão de mover a emissão na Fase 4.
4. **Sem `NetworkPolicy`** (decisão da Feature #313). É a razão da decisão 1:
   a validação local substitui a segunda camada de rede que não existirá.
5. **Roteamento direto por path**, sem BFF, mantendo o caminho atual
   API Gateway → VPC Link → ALB interno, agora com três destinos:

   | Path de entrada | Serviço de destino |
   |---|---|
   | `/os/*` | OS Service |
   | `/billing/*` | Billing Service |
   | `/execucao/*` | Execução e Produção |
   | `POST /auth` | Lambda `authenticate-customer` (rota pública, inalterada) |

   O Gateway mantém a rota única `/{proxy+}`; a diferenciação por serviço é
   feita por regra de listener do ALB (Feature #317). O mapa detalhado está em
   [`docs/architecture/edge-topology.md`](../architecture/edge-topology.md).
6. **Rotas públicas explícitas e sem authorizer no Gateway** (Feature #317):
   - aprovação, recusa e consulta de status de orçamento (`@Public()`,
     [ADR-0011](./0011-aprovacao-orcamento-api-publica.md)), apontando para o
     Billing Service;
   - webhook do Mercado Pago, cuja autenticação é a assinatura HMAC
     (`x-signature`), validada no Billing (Feature #325).
7. **Ambientes: a Fase 4 é HML-only.** Não haverá PROD na Fase 4 e nenhuma
   decisão de PROD é tomada aqui. O PROD da Fase 3 permanece como está.
8. **Cluster Kubernetes compartilhado** pelos três serviços, em namespaces e
   deployments separados. A defesa por escrito (custo de conta acadêmica,
   risco de ponto único de falha) está na
   [ADR-0020](./0020-bancos-compartilhados-isolamento-credencial.md), junto
   com a da instância RDS compartilhada, como decidido em conjunto; esta ADR
   apenas a referencia.
9. A [ADR-0008](./0008-autenticacao-local-jwt-rbac.md) passa a **Parcialmente
   substituída** por esta ADR: a validação local e o RBAC permanecem, agora
   como segunda camada atrás do Authorizer e replicados nos serviços novos.

## Alternativas consideradas

- **Autenticação 100% na borda, serviços sem JWT** (a proposta original da
  #311): recusada. Exigiria network policy para não deixar os pods sem
  autenticação, e o grupo decidiu não implementá-la (Feature #313). Também
  perderia o RBAC por papel dentro do serviço, já que o Authorizer responde
  apenas `isAuthorized`.
- **Biblioteca compartilhada de validação de token**: recusada. Reacopla os
  serviços por pacote e exige publicação e versionamento de pacote, o mesmo
  motivo pelo qual o catálogo de eventos usa tipos duplicados (ADR-0018). A
  cópia de `src/auth/` tem custo quase nulo e cada serviço evolui sozinho.
- **Propagar `sub`/`role` do Authorizer como header**: recusada. Mudaria
  `repo-auth-serverless` e o mapeamento do Gateway, e o serviço ainda ficaria
  aceitando header forjado em acesso direto ao pod.
- **BFF na frente dos serviços**: recusada. Um BFF agrega e adapta respostas
  para um frontend; o projeto não tem frontend, então seria um serviço a mais
  (código, deploy, ponto de falha) para um consumidor inexistente.

## Consequências positivas

- Sem `NetworkPolicy`, nenhum pod fica aceitando requisição sem token: o acesso
  direto ao pod continua exigindo JWT válido.
- Reuso de código já pronto e testado; o OS Service não muda de comportamento.
- Nenhum componente novo no caminho da requisição: o desenho API Gateway →
  VPC Link → ALB já existe.

## Consequências negativas

- **A validação de token existe em três lugares** (cópia do `src/auth/` em cada
  serviço). Correção de bug ou rotação de chave pública exige replicar a
  mudança. Aceito pelo tamanho do código e pelo prazo.
- **Rotas públicas exigem rota sem authorizer no Gateway**, além de `POST /auth`,
  e cada uma carrega sua própria proteção (assinatura no webhook, ADR-0011 na
  aprovação de orçamento).
- **Sem isolamento de rede**: um pod comprometido alcança os demais. Risco
  aceito em HML acadêmico (ver ADR-0020).
- Cluster único: falha do cluster afeta os três serviços (ver ADR-0020).

## Riscos

- **Médio — divergência entre as cópias de `src/auth/`**: claims, `issuer`,
  `audience` e chave pública devem permanecer iguais nos três serviços e no
  Authorizer. Mitigação: a cópia nasce idêntica e a chave pública vem do mesmo
  parâmetro SSM.
- **Médio — rota pública sem proteção própria**: uma rota marcada sem authorizer
  passa a ser um endpoint aberto na internet. O webhook do Mercado Pago só muda
  status de pagamento depois de validar a assinatura e reconsultar o pagamento
  (Feature #325).
- **Baixo — `HS256` local em ambiente remoto**: o modo de desenvolvimento local
  usa o mecanismo já existente, que recusa HS256 em produção
  (`resolveJwtContract`). O overlay `aws` do OS Service
  (`k8s/overlays/aws/configmap-patch.yaml`) define `NODE_ENV=production` com
  `JWT_ALGORITHM=RS256` e `JWT_EXPIRES_IN=1800`, então o HML já roda no modo
  estrito. Os serviços novos devem nascer com o mesmo ConfigMap; do contrário
  o boot falha por contrato JWT incompleto.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.5
- `fase4-decisoes-epico1.md`, seção F5 (fora do repositório, workspace local do grupo)
- Issue [#311](https://github.com/Async-And-Furious/async-furious-project/issues/311) — Definir Topologia de Infraestrutura e Borda
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- Epic [#312](https://github.com/Async-And-Furious/async-furious-project/issues/312) e Features
  [#313](https://github.com/Async-And-Furious/async-furious-project/issues/313) (sem `NetworkPolicy`),
  [#317](https://github.com/Async-And-Furious/async-furious-project/issues/317) (borda e rotas públicas),
  [#325](https://github.com/Async-And-Furious/async-furious-project/issues/325) (webhook Mercado Pago),
  [#332](https://github.com/Async-And-Furious/async-furious-project/issues/332) (RBAC do OS Service)
- [ADR-0002 — Autenticação centralizada via API Gateway + Function Serverless](./0002-autenticacao-centralizada-api-gateway-serverless.md)
- [ADR-0008 — Autenticação e autorização locais](./0008-autenticacao-local-jwt-rbac.md) (parcialmente substituída)
- [ADR-0017 — Divisão em três microsserviços](./0017-divisao-microsservicos-ownership-dados.md)
- [ADR-0020 — Bancos compartilhados com isolamento por credencial](./0020-bancos-compartilhados-isolamento-credencial.md)
- [`docs/architecture/edge-topology.md`](../architecture/edge-topology.md)
- `repo-auth-serverless` (Lambda Authorizer) e `repo-k8s-infra` (VPC, EKS, ALB)
