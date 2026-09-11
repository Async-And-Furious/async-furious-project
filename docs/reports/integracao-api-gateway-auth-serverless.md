# Relatório — Integração da Function Serverless de Autenticação ao API Gateway

Data: 2026-09-11
Escopo: `async-furious-project`, `repo-auth-serverless`, `repo-db-infra`

## Resumo executivo

A arquitetura descrita na issue (API Gateway + AWS Lambda serverless para autenticação, JWT usado para autorização) **já estava desenhada e majoritariamente implementada** antes desta análise — não foi um trabalho do zero. O que este trabalho fez foi: auditar os três repositórios envolvidos, encontrar e corrigir uma lacuna de observabilidade que escondia a causa de uma falha real em produção, sincronizar branches `develop` que haviam ficado defasadas de `main`, e fechar a lacuna de autorização que restava (nenhuma rota de negócio usava o JWT de cliente emitido pelo Gateway).

## Estado por critério de aceite da issue

| Critério | Status | Evidência |
|---|---|---|
| API Gateway configurado | ✅ Já implementado | `repo-auth-serverless/infra/{hml,prod}` — Terraform puro, HTTP API v2, rotas `/auth` e `/{proxy+}` |
| Integração com a Function Serverless concluída | ✅ Já implementado | Lambdas `authenticate-customer` e `authorize-request` (Lambda Authorizer customizado), testadas |
| Autenticação funcionando | ✅ Confirmado nesta análise (HML) | Smoke test `auth-smoke.yml` rodou com sucesso ponta a ponta em HML após correção do dado semeado |
| JWT validado | ✅ Já implementado | RS256, chave privada no Secrets Manager, pública no SSM; `JwtCustomerStrategy` no monólito revalida o token (defense in depth) |
| APIs protegidas utilizando o Gateway | ✅ Corrigido nesta análise | Nenhuma rota de negócio usava `Role.CLIENTE`/`JwtCustomerAuthGuard` até agora — ver PR #226 |
| Documentação atualizada | ✅ Já em dia | ADR-0002, RFC-003, RFC-006 e `docs/architecture/authentication-flow.md` já descreviam a arquitetura corretamente |

## O que foi encontrado

### 1. Arquitetura já decidida e majoritariamente implementada
- `async-furious-project`: ADR-0002 (autenticação centralizada via API Gateway/serverless), RFC-003 (ownership do Gateway e integração via VPC Link + ALB interno) e RFC-006 (Lambda Authorizer customizado, RS256) descrevem exatamente o modelo pedido pela issue.
- `repo-auth-serverless`: dois handlers Lambda (`authenticate-customer`, `authorize-request`), Terraform próprio por ambiente (`infra/hml`, `infra/prod`) provisionando HTTP API, rotas, Lambda Authorizer, VPC Link condicional.
- `repo-db-infra`: corretamente **não** participa dessa integração (por desenho — RFC-003 mantém API Gateway fora do escopo de banco de dados).

### 2. Falha ativa em produção no momento da análise
Havia um workflow (`Auth deploy and smoke test`, em `repo-auth-serverless`, branch `main`) tentando validar a autenticação em produção, falhando repetidamente com `401` tanto via API Gateway quanto na invocação direta da Lambda. A infraestrutura (Lambda `Active`, RDS `available`, secret configurada) estava saudável — o problema era de **dado**, não de rede: o CPF usado no smoke test não correspondia a nenhum cliente ativo semeado no banco de HML/produção.

Um colega já estava corrigindo isso em paralelo (`scripts/seed.ts`, PRs #223–#225 em `async-furious-project`) adicionando um cliente de smoke test controlado via `SEEDED_CPF`. Após o deploy de HML rodar com esse seed, o smoke test de HML passou integralmente. **Produção não foi testada nem re-deployada nesta sessão**, por decisão explícita do usuário — o gap está documentado abaixo.

### 3. Lacuna de observabilidade (corrigida)
O handler `authenticate-customer` retorna `401` genérico tanto para CPF malformado quanto para cliente inexistente/inativo, por desenho (evita side-channel). Porém o coletor de diagnóstico do smoke test só capturava logs `level=error` ou eventos terminando em `_failed` — como a rejeição é logada como `level=info`/`event=..._rejected`, o diagnóstico automático não mostrava nada, dificultando a investigação real do incidente de produção.

**PR:** [repo-auth-serverless#51](https://github.com/Async-And-Furious/repo-auth-serverless/pull/51) — adiciona um campo `rejection_reason` (`invalid_request` | `invalid_cpf_format` | `customer_not_found_or_inactive`) ao log interno (nunca à resposta HTTP, nunca ao CPF em si) e amplia o filtro do smoke test para capturar eventos `_rejected`.

### 4. Branches `develop` defasadas
- `repo-auth-serverless`: `develop` estava **49 commits atrás** de `main` (todo o hardening de rede da Lambda, o workflow completo de smoke test, e a reescrita do modelo de credenciais). Havia um PR já aberto (#32) tentando esse merge, mas em conflito.
  **PR:** [repo-auth-serverless#52](https://github.com/Async-And-Furious/repo-auth-serverless/pull/52) — substitui o #32 (fechado), `develop` agora idêntica a `main`.
- `repo-db-infra`: `develop` estava **10 commits atrás** de `main`, sem os guardrails de destroy de produção (unlock de RDS antes de destroy, confirmação obrigatória, fixes de subnet/route table).
  **PR:** [repo-db-infra#27](https://github.com/Async-And-Furious/repo-db-infra/pull/27) — fast-forward limpo, sem conflitos.
- `async-furious-project`: `develop` já estava em dia com `main` (main só tinha 1 commit a mais, sendo um merge de promoção `develop→main`). Nenhuma ação necessária.

### 5. Rotas de negócio nunca protegidas pelo fluxo de cliente (corrigido)
Apesar de `JwtCustomerStrategy`/`JwtCustomerAuthGuard` existirem desde a implementação do ADR-0002, nenhuma rota de negócio os usava — as rotas de consulta de status e aprovação/recusa de orçamento eram totalmente `@Public()`, protegidas só pela imprevisibilidade do UUID da OS.

**PR:** [async-furious-project#226](https://github.com/Async-And-Furious/async-furious-project/pull/226) — `GET /ordens-servico/:id/status`, `PATCH /ordens-servico/:id/orcamento/aprovar` e `PATCH /ordens-servico/:id/orcamento/recusar` agora exigem um JWT de cliente válido (RS256, emitido pela Function via API Gateway). Detalhe de implementação importante: `@Roles(Role.CLIENTE)` foi deliberadamente **omitido**, porque o `RolesGuard` global roda antes de qualquer guard de método e avaliaria a role antes do `JwtCustomerAuthGuard` autenticar a requisição — como a strategy `jwt-customer` só pode produzir `Role.CLIENTE`, o guard de autenticação sozinho já basta.

## O que NÃO foi feito (gaps conhecidos, para decisão do time)

1. **Produção não foi validada.** O smoke test de produção (`repo-auth-serverless`) segue com o mesmo problema de dado (cliente de smoke test não semeado). É necessário rodar `deploy-eks.yml` com `environment=prod`, `seed_prod=true`, `seed_customer=true` (ação de escrita real em produção — requer aprovação explícita).
2. **Sem verificação de posse (ownership).** A proteção adicionada em #226 garante *autenticação* (token de cliente válido), mas não verifica se o cliente autenticado é o dono daquela OS específica — qualquer cliente autenticado que souber o UUID ainda pode consultar/aprovar/recusar orçamento de outra pessoa. Antes, isso valia para qualquer pessoa (sem autenticação); agora só vale para clientes autenticados. Fechar esse gap exigiria comparar `request.user.id` com o `clienteId` da OS nos use cases — não implementado aqui por ser uma mudança de escopo maior (contrato dos use cases), fora do que foi pedido nesta tarefa.
3. **Rota `GET :id/rastreamento` e `POST :id/aprovar-servico` seguem públicas.** Não foram incluídas no escopo definido pelo usuário (só orçamento + status), mas fazem exatamente o mesmo tipo de exposição.
4. **Staff (ADMIN/RECEPCIONISTA/MECANICO) segue em HS256 local**, fora do modelo de Gateway/Lambda — decisão já registrada como fora de escopo no ADR-0002, não alterada aqui.
5. Erro de typecheck pré-existente, não relacionado a este trabalho: `src/auth/strategies/jwt.strategy.spec.ts` (linhas 38, 75, 105) tem incompatibilidade de tipos com `AuthenticatedUser`; os testes passam em runtime (`ts-jest`), mas `npm run type:check` falha. Vale abrir uma tarefa separada.

## PRs abertos nesta sessão

| Repositório | PR | O quê |
|---|---|---|
| repo-auth-serverless | [#51](https://github.com/Async-And-Furious/repo-auth-serverless/pull/51) | Log do motivo de rejeição de autenticação (observabilidade) |
| repo-auth-serverless | [#52](https://github.com/Async-And-Furious/repo-auth-serverless/pull/52) | Sincroniza `develop` com `main` (substitui #32, fechado) |
| repo-db-infra | [#27](https://github.com/Async-And-Furious/repo-db-infra/pull/27) | Sincroniza `develop` com `main` |
| async-furious-project | [#226](https://github.com/Async-And-Furious/async-furious-project/pull/226) | Protege status e orçamento com JWT de cliente do Gateway |

## Como testar (runbook)

### Smoke test de autenticação (HML)
```bash
gh workflow run auth-smoke.yml --repo Async-And-Furious/repo-auth-serverless --ref main -f environment=hml
gh run watch <run-id> --repo Async-And-Furious/repo-auth-serverless --exit-status
```
Isso reaplica o Terraform (`deploy_auth_only=false`) e chama `/auth` com o CPF em `secrets.SEEDED_CPF`, verificando um JWT estruturalmente válido na resposta.

### Deploy do monólito com seed do cliente de smoke test (HML)
```bash
gh workflow run deploy-eks.yml --repo Async-And-Furious/async-furious-project --ref develop \
  -f environment=hml -f seed_customer=true
```

### Produção (requer aprovação explícita — ação de escrita real)
```bash
gh workflow run auth-smoke.yml --repo Async-And-Furious/repo-auth-serverless --ref main -f environment=prod -f confirm="APPLY PROD"
gh workflow run deploy-eks.yml --repo Async-And-Furious/async-furious-project --ref main \
  -f environment=prod -f seed_prod=true -f seed_customer=true
```

### Testar a rota protegida localmente
```bash
curl -X POST https://<api-gateway-endpoint>/auth -H 'content-type: application/json' -d '{"cpf":"<cpf-do-cliente>"}'
# copie o token da resposta
curl https://<backend>/api/v1/ordens-servico/<id>/status -H "Authorization: Bearer <token>"
```
