# Roteiro de validação em HML (Fase 4)

Passo a passo para fechar os critérios "verificado em HML" dos cards da Fase 4 e gravar o
vídeo (#353) com a mesma sequência. Cada passo diz qual card ele fecha e qual evidência guardar
(print ou saída do comando) para o PDF (#352).

**Antes de começar**
- Os três serviços precisam estar em HML: o OS (`deploy-eks.yml` deste repositório), o
  Billing (`repo-billing`) e o Execução (`repo-execucao-service`, depois do merge
  `develop` → `main`).
- No terminal: credenciais AWS do grupo, `aws`, `curl` e `jq`. Os passos 2 a 4 passam todos
  pela API Gateway e pelo New Relic.
- O `kubectl` (o `historico` do passo 2 e os passos 5 e 6) só funciona com o endpoint do EKS
  liberado para o seu IP. Por padrão ele só abre, temporariamente, para o runner do GitHub
  durante o deploy. Sem esse acesso, use o New Relic: o log `[P-14]` da compensação e o
  `os.status.transition`.
- Anote a data e o commit de cada serviço no topo das evidências.

## 0. Preparação

Os segredos são os do environment `hml` (os mesmos que o `scripts/seed.ts` e o
`full-acceptance.yml` usam). Exporte-os sem eco e fora da gravação:

```bash
read -rs SEED_ADMIN_EMAIL; read -rs SEED_ADMIN_PASSWORD
read -rs SEED_RECEPCIONISTA_PASSWORD; read -rs SEED_MECANICO_PASSWORD; read -rs SEEDED_CPF
export SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD SEED_RECEPCIONISTA_PASSWORD SEED_MECANICO_PASSWORD SEEDED_CPF
```

```bash
export AWS_REGION=us-east-2   # região do environment hml
API=$(aws apigatewayv2 get-apis --query "Items[?Name=='tc3-auth-hml'].ApiEndpoint | [0]" --output text)
echo "$API"

req() { curl -sS -H 'content-type: application/json' -H "x-correlation-id: roteiro-$(date +%s)" "$@"; }

# 1) Token de cliente (Lambda authenticate-customer, por CPF de cliente ativo).
#    POST /auth não tem authorizer; o Bearer é um valor fixo, como no full-acceptance.yml.
CLIENTE=$(req -H 'authorization: Bearer acceptance-gateway-token' \
  -d "{\"cpf\":\"$SEEDED_CPF\"}" "$API/auth" | jq -r .token)

# 2) Tokens de staff. O /api/v1/auth/login não está nas rotas públicas da borda: passa pelo
#    authorizer, que exige um JWT de cliente válido (full-acceptance.yml faz o mesmo).
login() { req -H "authorization: Bearer $CLIENTE" \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" "$API/api/v1/auth/login" | jq -r .access_token; }
RECEP=$(login recepcionista@oficina.com "$SEED_RECEPCIONISTA_PASSWORD")   # e-mail fixo no seed
MEC=$(login mecanico@oficina.com "$SEED_MECANICO_PASSWORD")               # e-mail fixo no seed
ADMIN=$(login "$SEED_ADMIN_EMAIL" "$SEED_ADMIN_PASSWORD")

# 3) Peça usada nos passos 2 e 3. As peças do seed não servem: o id delas vem de um hash e
#    não é um UUID válido, e a criação da OS exige UUID (IsUUID). Por isso o roteiro usa uma
#    peça de demonstração criada pela API (DEMO-FO-001), criada só se ainda não existir.
#    A listagem é paginada (10 por página por padrão), daí o limit.
achar_peca() { req -H "authorization: Bearer $ADMIN" "$API/api/v1/pecas?limit=100" \
  | jq -r '[.data[] | select(.codigo == "DEMO-FO-001")][0].id // empty'; }
PECA=$(achar_peca)
[ -z "$PECA" ] && PECA=$(req -H "authorization: Bearer $ADMIN" -d '{"nome":"Filtro de Óleo (demo)",
  "codigo":"DEMO-FO-001","descricao":"Peça do roteiro de demonstração da Fase 4","preco":45.9,
  "quantidade_estoque":100,"quantidade_minima":5}' "$API/api/v1/pecas" | jq -r .id)

for v in CLIENTE RECEP MEC ADMIN PECA; do [ -n "${!v}" ] && [ "${!v}" != null ] && echo "$v ok" || echo "$v FALHOU"; done
```

A Lambda de cliente devolve `token`; o login de staff devolve `access_token`. Se algum item
aparecer como `FALHOU`, pare aqui: os passos seguintes dependem dele.

## 1. Borda: uma requisição por serviço (#317, #360)

```bash
# Sem token: só /status é público; o resto responde 401 do authorizer
req -o /dev/null -w '%{http_code}\n' "$API/api/v1/ordens-servico"                          # 401
req -o /dev/null -w '%{http_code}\n' "$API/api/v1/health/live"                             # 401 em HML

# Cada recurso chega ao serviço certo (pelo Swagger de cada um; nenhum é rota pública)
req -o /dev/null -w 'OS %{http_code}\n'        -H "authorization: Bearer $RECEP" "$API/api/docs"           # 200
req -o /dev/null -w 'Billing %{http_code}\n'   -H "authorization: Bearer $RECEP" "$API/api/docs/billing"   # 200
req -o /dev/null -w 'Execucao %{http_code}\n'  -H "authorization: Bearer $MEC"   "$API/api/docs/execucao"  # 200

# Token de cliente em rota de staff: 403 (#360)
req -o /dev/null -w '%{http_code}\n' -H "authorization: Bearer $CLIENTE" "$API/api/v1/ordens-servico"      # 403
```

Também vale mostrar no console da AWS os três target groups (`tc3-hml-app`, `tc3-hml-billing` e
`tc3-hml-execucao`) com os IPs dos pods saudáveis (#317).

## 2. Saga de ponta a ponta até FINISHED (#337, #321, #331)

```bash
# 2.1 Abrir a OS (recepcionista)
OS=$(req -H "authorization: Bearer $RECEP" -d '{
  "cliente": {"nome":"Cliente Demo","email":"demo@example.com","documento":"'"$SEEDED_CPF"'","tipoDocumento":"CPF"},
  "veiculo": {"placa":"DEM0A12","marca":"Honda","modelo":"Fit","ano":2021},
  "servicos": [], "pecas": [{"id_peca":"'"$PECA"'","quantidade":1}],
  "descricao":"Revisão (roteiro HML)"}' "$API/api/v1/ordens-servico" | jq -r .id)
status() { req "$API/api/v1/ordens-servico/$OS/status" | jq -c .; }
status                                                        # RECEIVED

# 2.2 Execução: a OS entra na fila de diagnóstico (OrdemServicoRecebida via Kafka)
EXE=$(req -H "authorization: Bearer $MEC" "$API/api/v1/execucoes?status=AGUARDANDO_DIAGNOSTICO" \
  | jq -r --arg os "$OS" '.[] | select(.ordemServicoId==$os) | .id')
req -X PATCH -H "authorization: Bearer $MEC" "$API/api/v1/execucoes/$EXE/iniciar-diagnostico" | jq -c .status
status                                                        # UNDER_DIAGNOSIS

# 2.3 Mecânico lança serviços e peças: OrcamentoCalculado → Billing gera o orçamento
req -X PATCH -H "authorization: Bearer $MEC" -d '{"valor_total_servicos":300,"valor_total_pecas":60}' \
  "$API/api/v1/ordens-servico/$OS/servicos-insumos" | jq -c .
status                                                        # AWAITING_APPROVAL (OrcamentoGerado)
req -H "authorization: Bearer $RECEP" "$API/api/v1/orcamentos/$OS" | jq -c '{status,valorTotalGeral}'

# 2.4 Cliente aprova (rota pública): devolve o link do Mercado Pago
req -X PATCH "$API/api/v1/orcamentos/$OS/aprovar" | jq -r .linkPagamento
```

Abra o link e pague no sandbox com **cartão de teste aprovado** (titular `APRO`; os cartões
estão na documentação de testes do Mercado Pago). Depois:

```bash
req -H "authorization: Bearer $RECEP" "$API/api/v1/pagamentos/$OS" | jq -c .status   # CONFIRMADO
status                                                        # continua AWAITING_APPROVAL
# O OS só grava o pago_em (não aparece no /status). Quem leva a OS a IN_PROGRESS é o
# ExecucaoIniciada, publicado no passo seguinte.

# 2.5 Reparo: o pagamento libera a fila de reparo
req -X PATCH -H "authorization: Bearer $MEC" "$API/api/v1/execucoes/$EXE/iniciar-reparo" | jq -c .status
status                                                        # IN_PROGRESS
req -X PATCH -H "authorization: Bearer $MEC" "$API/api/v1/execucoes/$EXE/concluir" | jq -c .status
status                                                        # FINISHED: fim da saga
```

Evidência: a saída de cada `status` com os marcos de tempo, e o histórico da OS. Nenhum
endpoint expõe o histórico (o `GET /api/v1/ordens-servico/$OS` serve o read model sem ele);
consulte a tabela `historico_status_os` pelo pod da API, sem mostrar a connection string:

```bash
historico() { kubectl -n async-furious exec deploy/async-furious-api -- node -e "
const { PrismaClient } = require('@prisma/client');
new PrismaClient().historicoStatusOS.findMany({ where: { ordem_servico_id: '$OS' }, orderBy: { data_hora: 'asc' } })
  .then(r => console.table(r.map(({ status_anterior, status_novo, motivo }) => ({ status_anterior, status_novo, motivo }))))"; }
historico
```

Se o `@prisma/client` não estiver na imagem, use o log `os.status.transition` no New Relic
(passo 4): ele prova a transição terminal, mas não traz o motivo.

## 3. Compensação: pagamento recusado (#338, #341, #326)

Anote o estoque da peça, repita 2.1 a 2.4 com uma OS nova (outra placa) e pague com o
**cartão de teste recusado** (titular `OTHE`).

```bash
ANTES=$(req -H "authorization: Bearer $ADMIN" "$API/api/v1/pecas/$PECA" | jq .quantidade_estoque)   # antes do 2.1
req -H "authorization: Bearer $RECEP" "$API/api/v1/pagamentos/$OS" | jq -c .status   # RECUSADO
status                                                        # CLOSED_WITHOUT_EXECUTION
req -H "authorization: Bearer $MEC" "$API/api/v1/execucoes?status=CANCELADA" \
  | jq -r --arg os "$OS" '.[] | select(.ordemServicoId==$os) | .status'           # CANCELADA
echo "antes: $ANTES  depois: $(req -H "authorization: Bearer $ADMIN" "$API/api/v1/pecas/$PECA" | jq .quantidade_estoque)"  # iguais
historico                                                     # ... → CLOSED_WITHOUT_EXECUTION
```

O `historico` (definido no passo 2) mostra o motivo `Pagamento recusado pelo Mercado Pago`.
Nenhum estorno é chamado, porque nada foi capturado: o `Pagamento` fica `RECUSADO`, não
`ESTORNADO`.

## 4. Observabilidade (#343, #344, #345)

No New Relic, conta do grupo:

```sql
-- trace distribuído: pegue o trace.id em APM > Distributed tracing (a requisição de 2.3, por
-- exemplo) e confira os três serviços no mesmo trace
SELECT appName, name, duration FROM Span WHERE trace.id = '<trace.id>' SINCE 1 hour ago
-- consumo Kafka por serviço (background transactions da propagação manual)
SELECT count(*) FROM Transaction WHERE name LIKE 'OtherTransaction/Kafka/%' FACET appName, name SINCE 1 hour ago
-- etapas da saga no Billing
SELECT average(durationMs) FROM SagaStep FACET service, step, outcome SINCE 1 hour ago
-- logs dos três serviços para a mesma OS (o correlationId dos logs HTTP é o id da requisição,
-- então o filtro é pelo ordemServicoId)
SELECT timestamp, entity.name, message FROM Log WHERE ordemServicoId = '<OS>' SINCE 1 hour ago
-- transições terminais da OS (sagas por resultado)
SELECT count(*) FROM Log WHERE logType = 'os.status.transition' FACET newStatus SINCE 1 day ago
```

Abra o dashboard `tc3-observability-hml`, página **Fluxo distribuído**, com dado dos três
apps. Para o vídeo: dashboard → clique num trace real → waterfall.

## 5. Borda e Billing: conferências de #378

```bash
# Item 19: o x-correlation-id enviado numa rota pública chega ao serviço
curl -sS -o /dev/null -H 'x-correlation-id: roteiro-corr-123' "$API/api/v1/ordens-servico/$OS/status"
kubectl -n async-furious logs deploy/async-furious-api --since=5m | grep roteiro-corr-123

# Item 14: cada cliente tem a própria cota nas rotas públicas do Billing (TRUST_PROXY_HOPS=2).
# O log de acesso mostra o IP do socket (o ALB), então a prova é pelo comportamento do limite
# (100 req/min). Na máquina A, estoure a cota:
for i in $(seq 1 105); do req -X PATCH -o /dev/null -w '%{http_code}\n' \
  "$API/api/v1/orcamentos/00000000-0000-4000-8000-000000000000/recusar"; done | sort | uniq -c   # aparecem 429
# Logo em seguida, de outra rede (máquina B, celular roteando ou um runner do GitHub):
curl -sS -X PATCH -o /dev/null -w '%{http_code}\n' "$API/api/v1/orcamentos/00000000-0000-4000-8000-000000000000/recusar"
# esperado: 404 (orçamento inexistente), não 429. Se der 429, a cota ainda está presa no IP do ALB.
```

## 6. Read model (#335)

```bash
# A fila e o detalhe vêm do DocumentDB; o histórico continua no Postgres
req -H "authorization: Bearer $RECEP" "$API/api/v1/ordens-servico?limit=5" | jq -c '.data[] | {id,status}'
# Rebuild num documento defasado: altere um campo direto no DocumentDB (ou apague o documento),
# rode o rebuild no pod da API e mostre que a leitura voltou a bater com o Postgres.
kubectl -n async-furious exec deploy/async-furious-api -- node dist/jobs/rebuild-read-model.job.js
```

Mostre também o `explain` da fila por índice (`idx_fila_prioridade`) e o segmento MongoDB no
New Relic, se aparecer.

## Checklist de evidências

| Card | Evidência | OK |
|---|---|---|
| #317 | Passo 1 e os target groups com alvos saudáveis | [ ] |
| #360 | 403 com token de cliente | [ ] |
| #337/#321/#331 | Passo 2 completo até `FINISHED` | [ ] |
| #338/#341/#326 | Passo 3: `CLOSED_WITHOUT_EXECUTION`, `CANCELADA` e estoque devolvido | [ ] |
| #343/#344/#345 | Passo 4: trace com os três serviços e o dashboard | [ ] |
| #378 (14, 19) | Passo 5 | [ ] |
| #335 | Passo 6 | [ ] |
