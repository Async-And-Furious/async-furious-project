# ADR-0022: Integração com o Mercado Pago — Checkout Pro, webhook assinado e reconsulta

## Status

Proposta — implementada no monólito em 20/10/2026 (Feature
[#325](https://github.com/Async-And-Furious/async-furious-project/issues/325),
branch `feat/325-checkout-pro-mercado-pago`). O estorno e a política para
pagamento recusado continuam em aberto (ver [Em aberto](#em-aberto)).

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
   (âncora da reconciliação) e `notification_url` só quando
   `MP_NOTIFICATION_URL` está definida. Sem `back_urls`/`auto_return`: não há
   página de retorno, e a confirmação vem só do webhook.
4. **Uma cobrança por OS.** Se a OS já tem `Pagamento` com link, a mesma
   cobrança é devolvida, sem nova preference. A idempotência é por consulta ao
   banco, não por `X-Idempotency-Key` na preference.
5. **Webhook `POST /api/v1/webhooks/mercado-pago`**, público, autenticado pela
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
6. **O status vem sempre da reconsulta** `GET /v1/payments/{id}`, nunca do
   corpo da notificação:
   - `approved` com valor igual ao da cobrança → `Pagamento` `CONFIRMADO` e
     `PagamentoConfirmadoEvent`;
   - `rejected`, `pending`, `in_process`, `cancelled` → só log; a cobrança
     continua aberta, porque no Checkout Pro o cliente pode tentar de novo no
     mesmo link;
   - valor divergente → não confirma e registra erro;
   - pagamento inexistente (`404`, como o simulador do painel) → `200` e
     ignorado;
   - falha na reconsulta → `502`, para o Mercado Pago reenviar.
7. **Processamento síncrono**, dentro do prazo de resposta do Mercado Pago
   (timeout de 5 s na reconsulta): uma falha devolve erro e aciona o reenvio,
   em vez de se perder num processamento assíncrono depois do `200`.
8. **Reentrega idempotente pelo status do `Pagamento`**: notificação de um
   pagamento já `CONFIRMADO` → `JA_CONFIRMADO`, sem salvar nem emitir evento.
9. **Evento próprio.** O webhook não reaproveita `PagamentoRegistrado`, que
   dispara a entrega da OS no fluxo da Fase 3 (`POST /pagamentos/registrar`,
   mantido como está).

## Alternativas consideradas

- **Checkout Transparente / Bricks**: exigem formulário de cartão e chave
  pública no cliente. Sem frontend no escopo, descartados.
- **Pix direto via `/v1/payments`** (plano B do spike): cobre um único meio de
  pagamento e exige `X-Idempotency-Key` e montagem do QR do nosso lado. Fica
  como alternativa se o Checkout Pro for bloqueado.
- **Validar o HMAC à mão**: o exemplo do plugin do Mercado Pago lê o `data.id`
  do corpo, divergindo da documentação oficial (query string). O validador do
  SDK segue a documentação e já trata comparação em tempo constante.
- **Responder `200` antes de processar**: recomendado pelo plugin, mas faria
  uma falha na reconsulta se perder sem reenvio.
- **Recusa terminal (`RECUSADO` + `PagamentoRecusado`)**, como no
  `saga-flow.md`: encerraria a cobrança na primeira tentativa recusada, embora
  o cliente ainda possa pagar no mesmo link. Adiada (ver Em aberto).
- **Tabela `webhook_recebido` para deduplicar**: prevista no spike para o
  Billing Service. No monólito, o status do `Pagamento` basta.

## Consequências positivas

- Nenhum dado de cartão passa pelo sistema, e o fluxo funciona sem frontend.
- Falhas do Mercado Pago não deixam estado inconsistente: o orçamento só é
  aprovado depois que a cobrança existe.
- A notificação não é confiável por si só: assinatura e reconsulta precisam
  bater, e o valor é conferido.
- A porta `ICobrancaPagamentoPort` e o `PagamentoConfirmadoEvent` isolam o
  `financeiro`, o que facilita mover a integração para o Billing Service.

## Consequências negativas

- No monólito, a OS ainda vai para `IN_PROGRESS` logo na aprovação, antes do
  pagamento; o `saga-flow.md` a mantém em `AWAITING_APPROVAL` até
  `PagamentoConfirmado`. Por isso, reaprovar dá `400` em vez de devolver o
  mesmo link, como a ADR-0011 pede.
- Nada consome `PagamentoConfirmadoEvent` por enquanto.
- O checklist oficial de qualidade do Mercado Pago aponta campos ausentes na
  preference: `statement_descriptor`, `back_urls`, dados do pagador (e-mail,
  nome, documento, telefone, que o `Cliente` já tem), `category_id` e
  `description` do item.
- Sem `X-Idempotency-Key`, duas aprovações simultâneas da mesma OS podem criar
  duas preferences antes de a primeira ser gravada.

## Riscos

- **Entrega real não testada.** Em 20/10/2026 o fluxo foi testado localmente
  com conta de teste: preference real, pagamento aprovado
  (operação #184177738229) e notificação assinada **simulada**, com reconsulta
  real. Falta confirmar que o Mercado Pago entrega e assina as notificações
  enviadas ao `notification_url` da preference (pergunta E3 do spike).
- **Segredos em HML.** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e
  `MP_NOTIFICATION_URL` ainda não estão nos segredos do Kubernetes/Terraform.
  Sem token, aprovar um orçamento pendente falha (`500`), o que pode quebrar a
  matriz de rotas (`docs/http/routes.yaml`, `scripts/route-matrix.py`).
- **Tipos do repositório.** O `OrcamentoRepository` devolve `Decimal` do
  Prisma apesar do tipo `number`; o valor é convertido na chamada da cobrança.
  Outros usos do valor podem repetir o problema.

## Em aberto

- **Estorno** (`POST /v1/payments/{id}/refunds`, experimento E7 do spike) e
  cancelamento de pagamento pendente. Para isso, convém guardar o id do
  pagamento do Mercado Pago no `Pagamento` (hoje só há `preference_id`).
- **Política para pagamento recusado**: manter a cobrança aberta (atual) ou
  torná-la terminal, como no `saga-flow.md`.
- **Quem consome `PagamentoConfirmadoEvent`** e quando a OS sai de
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
