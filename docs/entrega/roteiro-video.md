# Roteiro do vídeo de demonstração — microsserviços da oficina (#353)

**Duração orçada:** 14:00 (máximo: 15:00), com 1:00 de margem que não é tempo planejado. Os
tempos incluem fala, navegação e transições. **Estado:** este roteiro é um plano de gravação
e não afirma que HML, deploy, traces ou cenários estejam prontos. Cada item marcado
**[ensaio]** precisa ser confirmado no ensaio. Regras de segurança e de honestidade:
[spec da #353](../../specs/353-video-script/spec.md).

Os comandos vêm do [roteiro de validação em HML](roteiro-validacao-hml-fase4.md) e foram
conferidos no código em 15/11:

- `async-furious-project@develop`;
- `repo-billing@main`;
- `repo-execucao-service@develop`;
- `repo-auth-serverless@develop`;
- `repo-k8s-infra@develop`.

Nada foi executado em HML.

> Não aparecem na tela nem neste arquivo: CPF, número de cartão, token, senha, URL privada
> ou credencial. Segredos entram como variável de ambiente exportada fora da gravação.
> Termo para o vídeo: "ambiente de teste do Mercado Pago" (a ADR-0022 registra que não há
> sandbox dedicado).

## 1. Partes e responsáveis

O vídeo tem quatro blocos, que seguem a p.5 do enunciado. Dentro deles há **sete partes**,
cada uma com um dono. Cada dono grava a sua parte na própria máquina, e a edição junta
tudo. Quando uma parte continua a OS de outra, o id da OS passa de um dono para o outro
(seção 3).

| Parte | Bloco | Tempo no vídeo | Duração | Conteúdo | Responsável |
|---|---|---|---|---|---|
| A | 1 | 0:00-0:30 | 0:30 | Abertura e arquitetura | Trigo |
| B1 | 1 | 0:30-1:50 | 1:20 | Recepção e mecânico: abrir a OS, diagnóstico, orçamento | Jonathan |
| **C1** | 1 | 1:50-2:40 | 0:50 | **Mercado Pago: aprovação, Checkout Pro, webhook, `CONFIRMADO`** | **Felipe** |
| B2 | 1 | 2:40-3:00 | 0:20 | Mecânico: reparo e conclusão, OS em `FINISHED` | Jonathan |
| D1 | 2 | 3:00-4:20 | 1:20 | Estoque antes; OS nova até a aprovação (acelerado) | Vic |
| **C2** | 2 | 4:20-5:30 | 1:10 | **Mercado Pago: pagamento recusado, `RECUSADO`, sem estorno** | **Felipe** |
| D2 | 2 | 5:30-8:00 | 2:30 | Compensação no OS e no Execução, estoque, histórico, diagrama | Vic |
| E | 3 | 8:00-10:30 | 2:30 | CI/CD: proteção de branch, testes e cobertura, deploy, pod novo | Trigo |
| **F** | 4 | 10:30-13:30 | 3:00 | **New Relic: dashboard, trace atravessando o Kafka, logs por OS** | **Felipe** |
| G | 4 | 13:30-14:00 | 0:30 | Encerramento | Vic |

Cada parte ficou com quem mais trabalhou no assunto. O critério foi o responsável pela issue
e a autoria do código nos branches remotos em 15/11:

- **A (Trigo):** decisão do grupo em 15/11. Pelo critério de autoria, a parte seria do
  Felipe (#306, #348), que já fica com C e F.
- **B (Jonathan):** responsável pela #320, que trata da fila de execução e do domínio. Ele
  escreveu a maior parte dos controllers e use-cases do Execução.
- **C e F (Felipe):** responsável pelas issues #325 (Mercado Pago), #343 (APM) e #344
  (correlação no Kafka).
- **D (Vic):** responsável pela #338 (compensações) e autora da maior parte do handler de
  compensação do OS. Em linhas de compensação somando os três serviços, o Trigo vem à frente,
  mas ele já fica com o E, onde a diferença é bem maior.
- **E (Trigo):** responsável pela #317 e com a ampla maioria dos commits nos workflows do OS
  e no `repo-k8s-infra`.
- **G (Vic):** responsável pela #353 (o vídeo).

Tempo de vídeo por pessoa:

| Pessoa | Partes | Tempo |
|---|---|---|
| Felipe | C1, C2 e F | 5:00 |
| Vic | D1, D2 e G | 4:20 |
| Trigo | A e E | 3:00 |
| Jonathan | B1 e B2 | 1:40 |

A coordenação é do Trigo, conforme o comentário de 03/11 na #353. A edição e a publicação
ficam com a Vic, responsável pela #353.

## 2. Go/no-go antes de gravar

Estado em 15/11. Os blocos 1 e 2 dependem dos itens 1 a 4. Sem eles, vale o plano B
(seção 6).

| # | Precisa estar de pé em HML | Estado em 15/11 | Dono sugerido |
|---|---|---|---|
| 1 | **Execução deployado** (`execucao-api`, namespace `execucao`) | **Não.** A `main` do `repo-execucao-service` só tem o `README.md`, 42 commits atrás da `develop`. O `Deploy Execucao to HML EKS` só dispara em push na `main`. Falta o `NEW_RELIC_LICENSE_KEY` no environment `hml`. O Sonar falha fora da `main` | Trigo |
| 2 | OS na versão atual (`async-furious-api`, namespace `async-furious`) | Deploy parado desde a falha de 11/11; a migration da #330 não foi aplicada | Trigo |
| 3 | Billing com webhook real: `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` no `billing-secret`; `MP_NOTIFICATION_URL` no configmap, apontando para `$API/api/v1/webhooks/mercado-pago` | Billing subiu em 12/11; a notificação real não foi confirmada | **Felipe** |
| 4 | Borda com as rotas públicas `/status`, `aprovar`, `recusar` e o webhook | Estão na `develop` do `repo-auth-serverless`; a `main` não tem nenhuma rota pública | Trigo (#317) |
| 5 | Os três apps reportando ao New Relic, e o dashboard `tc3-observability-hml` com a página "Fluxo distribuído" (repo-k8s-infra#93) | `af-execucao-hml` depende do item 1 | **Felipe** |
| 6 | Credenciais AWS Academy renovadas e `kubectl` apontando para o cluster | — | cada um, antes da sua parte |
| 7 | Congelamento: nenhum merge na `develop` nem na `main` dos três serviços na janela de gravação | — | Trigo avisa o grupo |

## 3. Preparação (cada dono, fora da gravação)

Rode a seção 0 do [roteiro de validação](roteiro-validacao-hml-fase4.md#0-preparação): ela
traz os segredos lidos sem eco, os tokens e a peça. Depois carregue os helpers abaixo e dê
`clear` antes de gravar.

```bash
status()  { req "$API/api/v1/ordens-servico/$OS/status" | jq -c '{status, marcos}'; }
exe()     { req -H "authorization: Bearer $MEC" "$API/api/v1/execucoes?status=$1" \
              | jq -r --arg os "$OS" '.[] | select(.ordemServicoId==$os) | .id'; }
estoque() { req -H "authorization: Bearer $ADMIN" "$API/api/v1/pecas/$PECA" | jq .quantidade_estoque; }
pagamento() { req -H "authorization: Bearer $RECEP" "$API/api/v1/pagamentos/$OS" | jq -c '{status, valor}'; }
nova_os() { req -H "authorization: Bearer $RECEP" -d '{
  "cliente": {"nome":"Cliente Demo","email":"demo@example.com","documento":"'"$SEEDED_CPF"'","tipoDocumento":"CPF"},
  "veiculo": {"placa":"'"$1"'","marca":"Honda","modelo":"Fit","ano":2021},
  "servicos": [], "pecas": [{"id_peca":"'"$PECA"'","quantidade":1}],
  "descricao":"Demonstração Fase 4"}' "$API/api/v1/ordens-servico" | jq -r .id; }
```

**Passagem entre partes:** quem termina uma parte manda o `$OS` (e o `$EXE`, quando houver)
no canal do grupo. Quem continua faz `OS=<id>; EXE=<id>`, roda `status` para conferir o
estado de entrada e começa a gravar. A OS fica parada no estado entre um take e outro; a
preferência do Mercado Pago vale 48 h.

| Passagem | Estado de entrada | Quem entrega → quem recebe |
|---|---|---|
| B1 → C1 | OS em `AWAITING_APPROVAL`; orçamento `PENDING` | Jonathan → Felipe |
| C1 → B2 | pagamento `CONFIRMADO`; Execução em `AGUARDANDO_REPARO` | Felipe → Jonathan |
| D1 → C2 | OS nova em `AWAITING_APPROVAL`, ainda sem aprovação; `ANTES` (estoque) anotado pela Vic | Vic → Felipe |
| C2 → D2 | pagamento `RECUSADO` | Felipe → Vic |
| B2 → F | OS do bloco 1 em `FINISHED` (o trace do webhook é desta OS) | Jonathan → Felipe |

## 4. Partes

### Parte A — Abertura (0:30) · Trigo

| Tela | Fala-guia |
|---|---|
| Diagrama-mestre (`docs/architecture/overview.md` §1): OS, Billing e Execução, cada um com seu banco; Kafka no meio; API Gateway na borda | "O monólito virou três serviços. Cada um tem o seu banco, e eles conversam por eventos no Kafka, sem chamada HTTP entre eles. Vamos acompanhar uma ordem de serviço do início ao fim." |

### Parte B1 — Recepção e mecânico (1:20) · Jonathan

| Tempo | Quem | Comando | Esperado | Fala-guia |
|---|---|---|---|---|
| 0:00-0:20 | Recepcionista | `OS=$(nova_os DEM0A12); status` | `RECEIVED` | "A recepcionista abre a OS no OS Service, que publica `OrdemServicoRecebida`." |
| 0:20-0:40 | Mecânico | `EXE=$(exe AGUARDANDO_DIAGNOSTICO); echo $EXE` | id da `Execucao` | "O Execução consumiu o evento e pôs a OS na fila. O mecânico trabalha no Execução, não no OS." |
| 0:40-0:55 | Mecânico | `req -X PATCH -H "authorization: Bearer $MEC" "$API/api/v1/execucoes/$EXE/iniciar-diagnostico" \| jq -c .status; status` | `EM_DIAGNOSTICO`; OS em `UNDER_DIAGNOSIS` | "`DiagnosticoIniciado` volta para o OS, que atualiza o status." |
| 0:55-1:20 | Mecânico | `req -X PATCH -H "authorization: Bearer $MEC" -d '{"valor_total_servicos":300,"valor_total_pecas":60}' "$API/api/v1/ordens-servico/$OS/servicos-insumos" \| jq -c .; status` | `valorTotalGeral: 360`; OS em `AWAITING_APPROVAL` | "O OS publica `OrcamentoCalculado`; o Billing gera o orçamento e devolve `OrcamentoGerado`." |

Se `exe` voltar vazio, espere 2 a 3 segundos e rode de novo, porque o Kafka é assíncrono
(corte na edição). Termine passando o `$OS` e o `$EXE` para o Felipe.

### Parte C1 — Mercado Pago: pagamento aprovado (0:50) · Felipe

| Tempo | Tela | Comando / ação | Esperado | Fala-guia |
|---|---|---|---|---|
| 0:00-0:10 | Terminal | `req -H "authorization: Bearer $RECEP" "$API/api/v1/orcamentos/$OS" \| jq -c '{status,valorTotalGeral}'` | `PENDING`, 360 | "O orçamento mora no Billing." |
| 0:10-0:20 | Terminal | `LINK=$(req -X PATCH "$API/api/v1/orcamentos/$OS/aprovar" \| jq -r .linkPagamento); echo "$LINK" \| cut -c1-60` | início do link do Checkout Pro | "O cliente aprova por uma rota pública, sem login. O Billing cria a cobrança no Mercado Pago e devolve o link. O `external_reference` da cobrança é o id da OS." |
| 0:20-0:35 | Janela anônima, logada com o comprador de teste | Abrir o link e pagar com o cartão de teste de titular **`APRO`** (acelerar na edição) | pagamento aprovado | "Ambiente de teste do Mercado Pago, com comprador de teste." |
| 0:35-0:50 | Terminal | `pagamento` | `CONFIRMADO` | "O Mercado Pago notificou o webhook. O Billing valida a assinatura (`x-signature`, HMAC com o segredo do webhook), **reconsulta** o pagamento na API do Mercado Pago em vez de confiar no corpo da notificação e publica `PagamentoConfirmado`." |

Opcional, se sobrar tempo (+0:15): painel do Mercado Pago > a aplicação > Webhooks >
histórico de notificações, com a notificação respondida com 200. **[ensaio]**

Se perguntarem: um pagamento aprovado que chega depois de a cobrança ter saído de
`AGUARDANDO_PAGAMENTO` (atrasado ou duplicado) é estornado automaticamente pelo Billing. Não
demonstrar.

Termine passando o `$OS` e o `$EXE` de volta.

### Parte B2 — Reparo e conclusão (0:20) · Jonathan

| Comando | Esperado | Fala-guia |
|---|---|---|
| `status` | continua `AWAITING_APPROVAL` | "Pago, mas o reparo ainda não começou." |
| `req -X PATCH -H "authorization: Bearer $MEC" "$API/api/v1/execucoes/$EXE/iniciar-reparo" \| jq -c .status; status` | `EM_REPARO`; OS em `IN_PROGRESS` | "O pagamento liberou o reparo; `ExecucaoIniciada` move a OS." |
| `req -X PATCH -H "authorization: Bearer $MEC" "$API/api/v1/execucoes/$EXE/concluir" \| jq -c .status; status` | `CONCLUIDA`; OS em `FINISHED` | "`ExecucaoConcluida` fecha a saga: três serviços, nenhuma chamada direta entre eles." |

Depois do `CONFIRMADO` a OS continua em `AWAITING_APPROVAL`, porque o OS só grava o
`pago_em`, que não aparece no `/status`. Termine passando este `$OS` para o Felipe, para a
parte F.

### Parte D1 — Nova OS até a aprovação (1:20) · Vic

| Tempo | Comando | Esperado | Fala-guia |
|---|---|---|---|
| 0:00-0:20 | `ANTES=$(estoque); echo "estoque antes: $ANTES"` | número | "Agora, a falha. Primeiro o estoque da peça, para comparar no fim." |
| 0:20-1:20 (acelerado) | `OS=$(nova_os DEM0B34)`; `EXE=$(exe AGUARDANDO_DIAGNOSTICO)`; `iniciar-diagnostico`; `servicos-insumos`; `status` | `AWAITING_APPROVAL` | "Mesmo fluxo até o orçamento, com outra OS." |

Termine passando o `$OS` e o `$EXE` para o Felipe. Guarde o `ANTES`: ele é usado na D2.

### Parte C2 — Mercado Pago: pagamento recusado (1:10) · Felipe

| Tempo | Tela | Comando / ação | Esperado | Fala-guia |
|---|---|---|---|---|
| 0:00-0:10 | Terminal | `LINK=$(req -X PATCH "$API/api/v1/orcamentos/$OS/aprovar" \| jq -r .linkPagamento)` | link gerado | "O cliente aprova de novo." |
| 0:10-0:35 | Janela anônima | Pagar com o cartão de teste de titular **`OTHE`** | Mercado Pago recusa | "O cartão foi recusado. Isso é uma falha de negócio, não uma exceção." |
| 0:35-0:50 | Terminal | `pagamento` | `RECUSADO` | "O Billing grava `RECUSADO` e publica `PagamentoRecusado`. Ele não chama ninguém: só publica o fato." |
| 0:50-1:10 | Terminal ou slide | — | — | "Não há estorno: nada foi capturado. O estorno só existe para pagamento confirmado." |

Termine passando o `$OS` e o `$EXE` de volta.

### Parte D2 — Compensação nos serviços (2:30) · Vic

| Tempo | Serviço | Comando | Esperado | Fala-guia |
|---|---|---|---|---|
| 0:00-0:25 | OS | `status` | `CLOSED_WITHOUT_EXECUTION` | "O OS consumiu o `PagamentoRecusado` e encerrou a OS sem execução." |
| 0:25-0:50 | Execução | `exe CANCELADA` | o mesmo `$EXE` | "O Execução consumiu o mesmo evento e cancelou a execução. Nenhum coordenador mandou isso." |
| 0:50-1:10 | OS (estoque) | `echo "antes: $ANTES  depois: $(estoque)"` | os dois números iguais | "A reserva de peças foi liberada." |
| 1:10-1:40 | OS (histórico) | `historico` (do [roteiro de validação](roteiro-validacao-hml-fase4.md), passo 2) **[ensaio]** | linha `→ CLOSED_WITHOUT_EXECUTION` com o motivo `Pagamento recusado pelo Mercado Pago` | "O motivo fica no histórico da OS." |
| 1:40-2:30 | — | Diagrama da compensação (`docs/architecture/saga-flow.md`) | um evento, três reações | "Na saga coreografada, cada serviço desfaz a própria parte quando ouve o evento: Billing, OS e Execução." |

Fora do corte: OS parada pelo detector, endpoint de caos e derrubar serviço (vedados pela
#341 e pela #353).

### Parte E — CI/CD (2:30) · Trigo

O serviço demonstrado é o que tiver a run de deploy verde mais recente em HML. O candidato
hoje é o Billing (`CI` + `Deploy Billing to HML EKS`); o OS é a segunda opção.

**Fala obrigatória:** nos três serviços o deploy **não** é encadeado aos testes, porque o
`deploy-eks.yml` é um workflow separado. O que barra código sem teste é a proteção de
branch: o merge exige o check verde, e é o merge que dispara o deploy. Não dizer que o
pipeline de deploy roda os testes.

| Tempo | Tela | Evidência | Fala-guia |
|---|---|---|---|
| 0:00-0:20 | Os três repositórios | um `ci.yml`/`tests.yml` e um `deploy-eks.yml` em cada | "Cada serviço tem repositório, pipeline e deploy próprios." |
| 0:20-0:45 | Settings > Branches, regra da `main` | PR obrigatório e check de testes exigido | "Nada entra na `main` sem PR e testes verdes." |
| 0:45-1:30 | PR com os checks `tests` e `sonar` verdes | log do Jest com as quatro métricas ≥ 80% | "Se a cobertura cair abaixo de 80%, o check falha e o merge fica bloqueado." |
| 1:30-2:10 | Run do deploy disparada pelo merge (acelerada) | jobs `image` → `deploy-hml` verdes; imagem com tag do SHA | "O merge disparou o deploy só deste serviço." |
| 2:10-2:30 | `kubectl -n billing get pods` e `kubectl -n billing get deploy billing-api -o jsonpath='{.spec.template.spec.containers[0].image}'` | pod novo com o mesmo SHA | "O pod novo está no ar com a versão que passou pelos testes." |

### Parte F — New Relic (3:00) · Felipe

Use a OS do bloco 1 (`FINISHED`). Antes de gravar, ache o trace do webhook dessa OS **[ensaio]**:

```sql
SELECT traceId, appName, name, timestamp FROM Transaction
WHERE appName = 'af-billing-hml' AND name LIKE '%webhooks/mercado-pago%' SINCE 3 hours ago
```

| Tempo | Onde | Ação | Esperado | Fala-guia |
|---|---|---|---|---|
| 0:00-0:35 | Dashboard `tc3-observability-hml`, página **Fluxo distribuído** | Janela da gravação | throughput, erro, consumo Kafka por serviço e transições terminais da OS, com dados de `async-furious-project-hml`, `af-billing-hml` e `af-execucao-hml` | "O painel mostra o fluxo entre os três serviços. Mas painel não é rastreamento: vamos ao trace." |
| 0:35-1:35 | APM > Distributed tracing > o trace do webhook | Waterfall | Billing (webhook) → Kafka `billing.eventos.v1` → consumo no OS e no Execução (`OtherTransaction/Kafka/...`) | "O pagamento que vimos no bloco 1. O Billing publica `PagamentoConfirmado` com o contexto do trace no header da mensagem (`traceparent`/`newrelic`), e os consumidores continuam o mesmo trace." |
| 1:35-2:00 | Query builder | `SELECT appName, name, duration FROM Span WHERE trace.id = '<traceId>' SINCE 3 hours ago` | linhas de três `appName` | "Um trace, três serviços." |
| 2:00-2:40 | Query builder (Logs) | `SELECT timestamp, entity.name, message FROM Log WHERE ordemServicoId = '<OS>' SINCE 3 hours ago` **[ensaio: atributo nos logs do Billing e do Execução]** | linhas dos três serviços para a mesma OS | "Não existe um trace único da saga: cada ação abre o seu. O `ordemServicoId`, que vai nos logs e é o `correlationId` dos eventos, liga todos." |
| 2:40-3:00 | Query builder | `SELECT average(durationMs) FROM SagaStep FACET step, outcome SINCE 1 day ago` | etapas `orcamento` e `compensacao` | "Métrica de negócio das etapas da saga no Billing." Não dizer que é dos três serviços: só o Billing grava `SagaStep`. |

Se o trace do webhook não mostrar o OS ou o Execução, use o trace da requisição
`servicos-insumos` (OS → Kafka → Billing) e diga quais serviços apareceram.

### Parte G — Encerramento (0:30) · Vic

Recapitular os quatro itens (fluxo, saga com falha, deploy, observabilidade), mostrar os
links dos repositórios e dizer com honestidade o que ficou de fora (por exemplo, a OS
parada pelo detector).

## 5. Gravação, edição e publicação

- **Ensaio:** completo e cronometrado antes da gravação, com total ≤ 14:00.
- **Tela:**
  - 1080p;
  - terminal com fonte de no mínimo 18 pt;
  - zoom de 125% no GitHub e no New Relic.

  Texto ilegível invalida a evidência.
- **Takes:** cada parte num take próprio, com um take de reserva.
- **Edição:**
  - acelerar a pipeline, o checkout e a parte D1;
  - cortar as esperas do Kafka.
- **Revisão:** antes de publicar, rever o vídeo inteiro atrás de token, CPF, e-mail real ou
  URL privada na tela.
- **Publicação:** YouTube **não listado**, conferido numa janela anônima. O link vai para a
  Feature do PDF (#352), que é montado depois do vídeo.

## 6. Plano B (honesto)

Mostrar só o que aconteceu, dizer o que não foi validado e não montar estado.

| Parte | Se faltar… | Fazer |
|---|---|---|
| B1, B2, D2 | Execução em HML | Mostrar só o trecho do OS e do Billing e dizer que o Execução não estava publicado. **Não** usar as rotas do monólito no lugar das do Execução. |
| C1, C2 | Notificação do webhook | Reenviar a notificação real pelo histórico de notificações do painel do Mercado Pago. O "Simular notificação" não serve, porque o Billing ignora ids fictícios com 200. |
| D2 | Alguma compensação | Mostrar as que aconteceram e nomear a que faltou. |
| E | Run verde no dia | Usar a run verde mais recente, com a data visível, e dizer que é de outro dia. |
| F | Trace atravessando o Kafka | Mostrar os traces de cada serviço e os logs por `ordemServicoId`, e dizer que o trace entre serviços não foi validado. Não cobrir a lacuna com o dashboard. |

## 7. Pendências

Valem a partir de 15/11.

- **Ambiente:** os itens 1 a 5 da seção 2.
- **Divisão das partes:** cada pessoa confirma a sua parte (seção 1).
- **Ensaio e itens [ensaio]:** o ensaio completo e a confirmação de cada item marcado
  **[ensaio]**.
- **Entrega:** gravação, edição, revisão e publicação.
- **Divergência de documentação:** o `saga-flow.md` registra o motivo como "pagamento
  recusado", mas o código grava "Pagamento recusado pelo Mercado Pago". No vídeo, vale o
  que o código grava.

## Referências

- [Especificação da issue #353](../../specs/353-video-script/spec.md)
- [Roteiro de validação em HML](roteiro-validacao-hml-fase4.md)
- Issue [#341 — fluxo e preparação da demonstração](https://github.com/Async-And-Furious/async-furious-project/issues/341)
- Issue central: [#353 — Vídeo de Demonstração](https://github.com/Async-And-Furious/async-furious-project/issues/353)
