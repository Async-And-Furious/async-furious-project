# ADR-0022: Integração com o Mercado Pago — Checkout Pro, webhook assinado e reconsulta

## Status

Proposta — implementada no monólito em 20/10/2026 (Feature
[#325](https://github.com/Async-And-Furious/async-furious-project/issues/325),
branch `feat/325-checkout-pro-mercado-pago`). O estorno continua em aberto
(ver [Em aberto](#em-aberto)).

## Contexto

A [ADR-0011](./0011-aprovacao-orcamento-api-publica.md) e o
[`saga-flow.md`](../architecture/saga-flow.md) definem que a cobrança nasce da
aprovação do orçamento: o cliente aprova, recebe `{ linkPagamento }`, paga fora
do sistema, e o Mercado Pago avisa o Billing por webhook, autenticado por HMAC
(`x-signature`) mais a reconsulta do pagamento
([ADR-0021](./0021-borda-sem-bff.md), item 7). Faltava decidir o produto do
Mercado Pago, o formato da cobrança, como validar e tratar a notificação, e o
que fazer com cada status.

Restrições que pesaram:

- O projeto **não tem frontend** no escopo da Fase 4 (ADR-0021). Qualquer
  produto que exija formulário de cartão próprio (Checkout Transparente,
  Bricks) traria uma tela que ninguém entrega.
- O Mercado Pago **não tem mais sandbox**: testes rodam na API de produção com
  as credenciais da aba **Teste** (prefixo `APP_USR-`, de um vendedor de teste
  criado com a aplicação) e um comprador de teste.
- O Billing Service (#323) ainda não existe; a integração precisava rodar já
  no monólito, no módulo `financeiro`, sem impedir a migração depois.
- **O Mercado Pago não respeita `X-Idempotency-Key` em
  `/checkout/preferences`.** Testado em 20/10/2026 com a conta de teste: duas
  chamadas com a mesma chave (com o mesmo corpo e com corpo diferente) criaram
  preferences diferentes. A garantia de "uma cobrança por OS" precisa vir do
  nosso banco.

## Decisão

1. **Checkout Pro (Preferences API, `/checkout/preferences`)** com o SDK
   oficial `mercadopago` (3.6.1). A API devolve o `init_point` da preference
   como `linkPagamento`; o Mercado Pago hospeda a página de pagamento (cartão,
   Pix, saldo), sem dados de cartão no nosso sistema. Nunca
   `sandbox_init_point`.
2. **Cobrança criada na aprovação, antes de marcar o orçamento `APPROVED`.**
   `AprovarOrcamentoUseCase` chama a porta `ICobrancaPagamentoPort`
   (`src/shared/domain/interfaces`); o `financeiro` cria a preference e grava o
   `Pagamento` `AGUARDANDO_PAGAMENTO` com `preference_id` e `link_pagamento`.
   Falha no Mercado Pago → `502` e o orçamento segue `PENDING`.
3. **Preference mínima:** um item (`id` = `ordemServicoId`, quantidade 1,
   valor total do orçamento, `BRL`), `external_reference` = `ordemServicoId`
   (âncora da reconciliação), `notification_url` só quando
   `MP_NOTIFICATION_URL` está definida, e **sem `payer`** (o Billing não terá
   os dados do cliente). Sem `back_urls`/`auto_return`: não há página de
   retorno, e a confirmação vem só do webhook.
4. **Uma cobrança por OS, garantida pelo banco.** `Pagamento.ordemServicoId`
   é único. O `Pagamento` é **reservado** (inserido) antes de chamar o Mercado
   Pago; quem perde a reserva numa aprovação concorrente espera alguns
   segundos e devolve o mesmo link, sem chamar o Mercado Pago (`409` se a
   outra aprovação não terminar a tempo). Se o Mercado Pago falhar, a reserva
   é desfeita. A transição do orçamento `PENDING → APPROVED` é atômica
   (`updateMany` condicionado ao status), então só uma aprovação publica
   `OrcamentoAprovado`. Um `Pagamento` antigo pendente e sem link (ex.: do
   seed) é substituído; um `Pagamento` já encerrado bloqueia a aprovação
   (`409`).
5. **Timeout curto e 1 retry** nas chamadas ao Mercado Pago (5 s;
   `maxRetries: 1` no SDK, que já faz backoff exponencial em 429, 5xx e falha
   de rede).
6. **Webhook `POST /api/v1/webhooks/mercado-pago`**, público, autenticado pela
   assinatura:
   - validação com o `WebhookSignatureValidator` do SDK, sem criptografia
     própria. O manifesto é `id:{data.id};request-id:{x-request-id};ts:{ts};`,
     com o **`data.id` da query string** (em minúsculas), como manda a
     documentação oficial;
   - chave `MP_WEBHOOK_SECRET`, gerada no painel (Webhooks → Configurar
     notificação), **separada** do `WEBHOOK_SECRET` legado, que continua só
     para `webhooks/service-orders` (ADR-0021, item 7);
   - assinatura ausente ou inválida → `401`; tópico diferente de `payment` →
     `200` e ignorado.
7. **O status vem sempre da reconsulta** `GET /v1/payments/{id}`, nunca do
   corpo da notificação:
   - `approved` com valor igual ao da cobrança → `Pagamento` `CONFIRMADO` e
     `PagamentoConfirmadoEvent`;
   - `rejected`/`cancelled` → `Pagamento` `RECUSADO` e
     `PagamentoRecusadoEvent`, **terminal** (ver a simplificação abaixo);
   - `pending`, `in_process`, `authorized` → sem efeito e sem evento;
   - valor divergente → não confirma e registra erro;
   - `approved` para uma cobrança já encerrada (recusada antes, ou outro
     pagamento depois de confirmada) → não confirma e registra erro: exige
     estorno (em aberto);
   - pagamento inexistente (`404`, como o simulador do painel) → `200` e
     ignorado;
   - falha na reconsulta → `502`, para o Mercado Pago reenviar.
8. **Idempotência de entrada.** Tabela `webhook_recebido` com
   `@@unique(providerEventId, tipo)` (id do pagamento no Mercado Pago e
   `payment.{status}`), gravada **na mesma transação** que atualiza o
   `Pagamento`; o id do pagamento também é guardado no `Pagamento`
   (`mercado_pago_payment_id`, único). Reentrega, inclusive simultânea →
   `200` sem efeito. O evento só é emitido depois do commit.
9. **Processamento síncrono**, dentro do prazo de resposta do Mercado Pago:
   uma falha devolve erro e aciona o reenvio, em vez de se perder num
   processamento assíncrono depois do `200`.
10. **Evento próprio e o fluxo antigo.** O webhook não reaproveita
    `PagamentoRegistrado`, que dispara a entrega da OS (fluxo da Fase 3).
    `POST /pagamentos/registrar` deixa de criar ou marcar pagamento como
    `PAGO`: só dispara a entrega quando o `Pagamento` da OS está `CONFIRMADO`
    pelo Mercado Pago (`409` caso contrário).

### Simplificação: `rejected` terminal

No Checkout Pro o comprador pode tentar de novo na mesma preference depois de
uma recusa. A saga trata `rejected` como terminal e fecha a OS: aceitável para
a demonstração, prematuro em produção real. Um `approved` que chegue depois da
recusa não reabre a cobrança; fica registrado como erro e exige estorno.

## Alternativas consideradas

- **Checkout Transparente / Bricks**: exigem formulário de cartão e chave
  pública no cliente. Sem frontend no escopo, descartados.
- **Pix direto via `/v1/payments`** (plano B do spike): cobre um único meio de
  pagamento e exige montagem do QR do nosso lado. Fica como alternativa se o
  Checkout Pro for bloqueado.
- **`X-Idempotency-Key` na preference**: descartado depois do teste de
  20/10/2026, que mostrou que o endpoint ignora a chave.
- **Validar o HMAC à mão**: o exemplo do plugin do Mercado Pago lê o `data.id`
  do corpo, divergindo da documentação oficial (query string). O validador do
  SDK segue a documentação e já compara em tempo constante.
- **Responder `200` antes de processar**: faria uma falha na reconsulta se
  perder sem reenvio.
- **Manter a cobrança aberta depois de `rejected`**: mais fiel ao Checkout Pro,
  mas a saga precisa de um desfecho para fechar a OS.
- **Deduplicar só pelo status do `Pagamento`**: não protege duas entregas
  simultâneas; a constraint em `webhook_recebido` protege.

## Consequências positivas

- Nenhum dado de cartão passa pelo sistema, e o fluxo funciona sem frontend.
- Falhas do Mercado Pago não deixam estado: a reserva é desfeita e o orçamento
  só é aprovado depois que a cobrança existe.
- Aprovações e notificações concorrentes não duplicam cobrança, evento nem
  atualização (testado em 20/10/2026 contra o banco local).
- A notificação não é confiável por si só: assinatura e reconsulta precisam
  bater, e o valor é conferido.
- A porta `ICobrancaPagamentoPort` e os eventos `PagamentoConfirmadoEvent` e
  `PagamentoRecusadoEvent` isolam o `financeiro`, o que facilita mover a
  integração para o Billing Service.

## Consequências negativas

- No monólito, a OS ainda vai para `IN_PROGRESS` logo na aprovação, antes do
  pagamento; o `saga-flow.md` a mantém em `AWAITING_APPROVAL` até
  `PagamentoConfirmado`. Por isso, uma reaprovação **sequencial** dá `400` em
  vez de devolver o mesmo link (as concorrentes já devolvem).
- Nada consome `PagamentoConfirmadoEvent` nem `PagamentoRecusadoEvent` por
  enquanto.
- O checklist oficial de qualidade do Mercado Pago aponta campos ausentes na
  preference: `statement_descriptor`, `back_urls`, `category_id` e
  `description` do item, e dados do pagador (fora por decisão, item 3).
- Uma aprovação concorrente pode esperar alguns segundos pelo link, e recebe
  `409` se a outra não terminar a tempo.

## Riscos

- **Entrega real não testada.** Em 20/10/2026 o fluxo foi testado localmente
  com conta de teste: preference real, pagamento aprovado
  (operação #184177738229) e notificações assinadas **simuladas**, com
  reconsulta real. Falta confirmar que o Mercado Pago entrega e assina as
  notificações enviadas ao `notification_url` da preference (pergunta E3 do
  spike).
- **Migração com índice único.** `20261020150000_pagamento_idempotencia_mercado_pago`
  falha se algum ambiente já tiver mais de um `Pagamento` para a mesma OS
  (`POST /pagamentos/registrar` permitia). Conferir antes do deploy (a consulta
  está no topo da migração).
- **Segredos em HML.** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e
  `MP_NOTIFICATION_URL` ainda não estão nos segredos do Kubernetes/Terraform.
  Sem token, aprovar um orçamento pendente falha (`500`), o que pode quebrar a
  matriz de rotas (`docs/http/routes.yaml`, `scripts/route-matrix.py`).
- **Tipos do repositório.** O `OrcamentoRepository` devolve `Decimal` do
  Prisma apesar do tipo `number`; o valor é convertido na chamada da cobrança.
  Outros usos do valor podem repetir o problema.

## Em aberto

- **Estorno** (`POST /v1/payments/{id}/refunds`, experimento E7 do spike):
  para a compensação da saga, para o pagamento atrasado de uma OS já fechada e
  para o `approved` que chega depois de uma recusa. Se não funcionar com a
  conta de teste, entregar um fallback documentado antes da gravação do vídeo.
- **Quem consome os eventos de pagamento** e quando a OS sai de
  `AWAITING_APPROVAL`.
- Migração da integração para o Billing Service (#323).

## Referências

- [ADR-0011](./0011-aprovacao-orcamento-api-publica.md) — aprovação de
  orçamento e `{ linkPagamento }`
- [ADR-0016](./0016-saga-coreografada.md) e
  [`saga-flow.md`](../architecture/saga-flow.md) — saga e eventos de pagamento
- [ADR-0021](./0021-borda-sem-bff.md) — rota pública do webhook e HMAC
- [`service-order-flow.md`](../architecture/service-order-flow.md) — estado
  atual no monólito
- Código: `src/modules/financeiro/` (gateway, webhook, casos de uso) e
  `src/shared/domain/interfaces/cobranca-pagamento.port.ts`
- Documentação do Mercado Pago: Checkout Pro e Notificações → Webhooks
  (validação da origem da notificação)
