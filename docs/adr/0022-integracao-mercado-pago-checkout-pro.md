# ADR-0022: Integração com o Mercado Pago — Checkout Pro, webhook assinado e reconsulta

## Status

Proposta — texto atualizado em 27/10/2026 para refletir a implementação no
Billing; aguarda aceite do grupo.

A primeira implementação nasceu no monólito, no módulo `financeiro` (PR
[#366](https://github.com/Async-And-Furious/async-furious-project/pull/366),
Feature [#325](https://github.com/Async-And-Furious/async-furious-project/issues/325),
branch `feat/325-checkout-pro-mercado-pago`, 20/10/2026). Ela foi **portada
para o Billing Service**
([`repo-billing`](https://github.com/Async-And-Furious/repo-billing), mesma
Feature #325), que é onde a integração vive daqui em diante; o código do
monólito sai na Feature #330. O texto abaixo descreve o comportamento do
Billing. O que ficou diferente no monólito está em [Histórico](#histórico), e
o que continua sem decisão ou sem teste está em [Em aberto](#em-aberto).

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
- O Billing ainda não existia quando a integração foi escrita, então ela
  começou no monólito, sem impedir a migração depois.
- **O Mercado Pago não respeita `X-Idempotency-Key` em
  `/checkout/preferences`.** Testado em 20/10/2026 com a conta de teste: duas
  chamadas com a mesma chave (com o mesmo corpo e com corpo diferente) criaram
  preferences diferentes. A garantia de "uma cobrança por OS" precisa vir do
  nosso banco.

## Decisão

1. **Checkout Pro (Preferences API, `/checkout/preferences`)** com o SDK
   oficial `mercadopago`. A API devolve o `init_point` da preference como
   `linkPagamento`; o Mercado Pago hospeda a página de pagamento (cartão, Pix,
   saldo), sem dados de cartão no nosso sistema. Nunca `sandbox_init_point`.
2. **Cobrança criada na aprovação, antes de o orçamento ser gravado como
   `APPROVED`.** `AprovarOrcamentoUseCase` chama a porta `IGatewayPagamento`,
   que cria a preference. Falha no Mercado Pago → `502`, nada é gravado e o
   orçamento segue `PENDING`.
3. **Preference mínima:** um item (`id` = `ordemServicoId`, quantidade 1,
   valor total do orçamento, `BRL`), `external_reference` = `ordemServicoId`
   (âncora da reconciliação), `notification_url` só quando
   `MP_NOTIFICATION_URL` está definida, e **sem `payer`** (o Billing não tem os
   dados do cliente). Sem `back_urls`/`auto_return`: não há página de retorno,
   e a confirmação vem só do webhook. A preference é criada com `expires=true`
   e `expiration_date_to` = agora + `MP_PREFERENCE_EXPIRACAO_HORAS` (padrão
   **48 h**, o mesmo prazo do detector de OS parada da
   [ADR-0018](./0018-mensageria-contratos-eventos.md) e do
   [`saga-flow.md`](../architecture/saga-flow.md) §3). Isso **reduz** o
   pagamento atrasado, mas não o elimina. O formato do offset de
   `expiration_date_to` ainda não foi conferido contra a API real.
4. **Uma cobrança por OS, garantida pelo banco, sem reserva prévia.**
   `Pagamento.ordemServicoId` é único. A preference é criada no Mercado Pago
   **antes** do commit; depois, numa **única transação**, gravam-se
   `Orcamento = APPROVED` (atualização condicionada ao status `PENDING`) e
   `Pagamento = AGUARDANDO_PAGAMENTO`, com `preferenceId` e `linkPagamento`.
   `OrcamentoAprovado` é publicado **depois** do commit. O `Pagamento` não é
   inserido antes de chamar o Mercado Pago.
   - Uma **segunda aprovação** devolve o mesmo link, sem chamar o Mercado Pago
     e sem republicar o evento.
   - Em **aprovações concorrentes**, as duas podem criar preference: a
     vencedora grava; a perdedora faz rollback pela constraint única e devolve
     o link da vencedora. A preference da perdedora fica **órfã** no Mercado
     Pago. É inofensiva (ninguém recebe o link, e ela expira), mas é uma
     limitação conhecida.
   - Não existe `409` de espera por aprovação concorrente no Billing.
5. **Timeout curto e 1 retry** nas chamadas ao Mercado Pago (5 s;
   `maxRetries: 1` no SDK, que já faz backoff exponencial em 429, 5xx e falha
   de rede).
6. **Webhook `POST /api/v1/webhooks/mercado-pago`**, público, autenticado pela
   assinatura:
   - validação com o `WebhookSignatureValidator` do SDK, sem criptografia
     própria. O manifesto é `id:{data.id};request-id:{x-request-id};ts:{ts};`,
     com o **`data.id` da query string** (em minúsculas), como manda a
     documentação oficial. `data.id` repetido na query → `401`;
   - chave `MP_WEBHOOK_SECRET` (no `billing-secret`, ADR-0015), gerada no
     painel (Webhooks → Configurar notificação), **separada** do
     `WEBHOOK_SECRET` legado, que continua só para
     `webhooks/service-orders` (ADR-0021, item 7). Ela precisa ser a chave que
     assina as notificações **reais**; a hipótese, ainda não confirmada, é que
     seja a da aplicação do vendedor de teste (ver [Riscos](#riscos));
   - assinatura ausente ou inválida → `401`, sem efeito. Não há tolerância de
     `ts`: um replay de notificação válida só repete a reconsulta e cai na
     idempotência;
   - notificação que não é `type=payment` com `data.id` (IPN legado
     `?id=…&topic=payment`, `topic=merchant_order`, user agent "MercadoPago
     Feed v2.0") → `200` e ignorada, **sem** checar assinatura, porque não
     altera estado e nunca valida; com `401` seria reenviada sem fim.
7. **O status vem sempre da reconsulta** `GET /v1/payments/{id}`, nunca do
   corpo da notificação:
   - `approved` com o `Pagamento` em `AGUARDANDO_PAGAMENTO` e valor igual →
     `CONFIRMADO` e `PagamentoConfirmado`;
   - `rejected`/`cancelled` → `RECUSADO` e `PagamentoRecusado`, **terminal**
     (ver [Simplificação](#simplificação-rejected-terminal));
   - `pending`, `in_process`, `authorized` e demais → sem efeito, `200`;
   - `refunded`, `charged_back`, `in_mediation` → ignorados, `200`: um
     estorno ou chargeback feito direto no painel **não** altera o
     `Pagamento` (em aberto);
   - pagamento inexistente (`404` no Mercado Pago, como o simulador do painel)
     ou `external_reference` sem cobrança → `200` com aviso em log; com
     assinatura válida, indica `MP_ACCESS_TOKEN` de outra conta;
   - falha na reconsulta → `502`, para o Mercado Pago reenviar.
8. **Conferência de valor em centavos** (`Math.round(valor * 100)`, sem
   depender de ponto flutuante). Valor nulo não confirma. Valor divergente em
   cobrança pendente **não confirma e não estorna**: só log de erro, e o
   dinheiro fica retido (em aberto).
9. **Idempotência de entrada.** Tabela `webhook_recebido` com
   `@@unique(providerEventId, tipo)` (id do pagamento no Mercado Pago e
   `payment.{status}`), gravada **na mesma transação** que atualiza o
   `Pagamento` (`updateMany` condicionado ao status anterior); o id do
   pagamento também é guardado no `Pagamento` (`mercadoPagoPaymentId`, único).
   Reentrega, inclusive simultânea → `200` sem efeito. O evento só é emitido
   depois do commit.
   - **Corrida de status.** Se o `Pagamento` muda de status no meio do
     processamento (o `updateMany` condicionado afeta 0 linhas) e o id externo
     gravado **não** é o da notificação, a resposta é `409`
     (`ConflitoException`): o Mercado Pago reenvia e a nova leitura segue o
     ramo certo (ex.: `CANCELADO` vai para estorno). Se o id externo já é o da
     notificação, é `200` `JA_PROCESSADO`.
10. **Estorno de `approved` indevido** (`POST /v1/payments/{id}/refunds`,
    total, `X-Idempotency-Key: estorno-{id}`), resolvendo o que estava em
    aberto:
    - **pagamento atrasado** (`Pagamento` já `CANCELADO`: a saga fechou a OS
      antes de o cliente pagar) → estorna, **não** publica
      `PagamentoConfirmado` e o `Pagamento` segue `CANCELADO`
      (`ESTORNADO_PAGAMENTO_ATRASADO`);
    - **duplicidade** (cobrança já `RECUSADO`, `ESTORNADO` ou `CONFIRMADO` por
      outro id) → estorna (`ESTORNADO_PAGAMENTO_DUPLICADO`);
    - nenhum dos dois altera o status nem o `mercadoPagoPaymentId` do
      `Pagamento` original; a evidência é a linha em `webhook_recebido` mais o
      refund no painel do Mercado Pago;
    - `webhook_recebido` é consultado **antes** de estornar, e a chave de
      idempotência do Mercado Pago evita um segundo estorno numa reentrega;
    - **o estorno vem antes do registro**: se ele falhar, nada é gravado e a
      resposta é `502` (o Mercado Pago reenvia); se o registro falhar depois
      do estorno, o reenvio repete o estorno com a mesma chave. A janela de
      idempotência do Mercado Pago é de cerca de 24 h;
    - o **estorno por compensação da saga** (`EtapaDaSagaFalhou` com
      `Pagamento` `CONFIRMADO`, que passaria a `ESTORNADO`) **não está
      implementado**: `IGatewayPagamento.estornar` existe, mas quem a aciona
      é o handler da Feature #326.
11. **Consulta `GET /api/v1/pagamentos/{ordemServicoId}`**: JWT, papéis
    `ADMIN` e `RECEPCIONISTA`, como a consulta do orçamento. Devolve `id`,
    `ordemServicoId`, `valor`, `status`, `linkPagamento`, `pagamentoExternoId`,
    `criadoEm` e `atualizadoEm`; `404` se não existir. O Billing não guarda o
    dono da OS, então não restringe `CLIENTE` ao próprio pagamento. O
    [`saga-flow.md`](../architecture/saga-flow.md) e o
    [`edge-topology.md`](../architecture/edge-topology.md) só dizem "JWT" para
    essa rota; os papéis ficam registrados aqui e no README do Billing.
12. **Throttling.** O `ThrottlerGuard` global (100 req/min por IP, throttler
    `short`) vale para todas as rotas **exceto o webhook**
    (`@SkipThrottle({ short: true })`). Atrás do proxy (API Gateway/ALB), sem
    `trust proxy`, o IP de origem é o do proxy e uma rajada de reenvios
    receberia `429`. O webhook já é protegido pelo HMAC.
13. **Processamento síncrono**, dentro do prazo de resposta do Mercado Pago:
    uma falha devolve erro e aciona o reenvio, em vez de se perder num
    processamento assíncrono depois do `200`.

### Simplificação: `rejected` terminal

No Checkout Pro o comprador pode tentar de novo na mesma preference depois de
uma recusa. A saga trata `rejected` como terminal e fecha a OS: aceitável para
a demonstração, prematuro em produção real. Um `approved` que chegue depois da
recusa não reabre a cobrança; é estornado como duplicidade (item 10).

### Fallback se o refund não funcionar no sandbox

O refund real **ainda não foi executado** no sandbox: hoje só há teste
unitário (SDK mockado) e de rota (gateway falso). Se a conta de teste não
aceitar a chamada:

1. Diagnosticar com `curl` direto em `POST /v1/payments/{id}/refunds`, para
   separar credencial, pagamento não estornável e erro do Billing.
2. Estornar **manualmente** na conta do vendedor de teste. A reconsulta
   seguinte devolve `refunded`, que é ignorado com `200` (item 7), e o
   Mercado Pago para de reenviar.
3. Não existe status persistido de "estorno pendente" (o enum
   `StatusPagamento` não tem esse valor); o registro é o log de erro mais o
   histórico de entregas com `502`. Criá-lo seria uma decisão de modelo para o
   grupo.

Para o vídeo: a compensação mais simples de mostrar não exige refund, que é
aprovar o orçamento e recusar o pagamento (cartão de teste `OTHE`), gerando
`RECUSADO` e `PagamentoRecusado`. O refund é citado como implementado e
coberto por testes; se a chamada real falhar, mostra-se o estorno manual no
painel do vendedor de teste.

## Alternativas consideradas

- **Checkout Transparente / Bricks**: exigem formulário de cartão e chave
  pública no cliente. Sem frontend no escopo, descartados.
- **Pix direto via `/v1/payments`** (plano B do spike): cobre um único meio de
  pagamento e exige montagem do QR do nosso lado. Fica como alternativa se o
  Checkout Pro for bloqueado.
- **`X-Idempotency-Key` na preference**: descartado depois do teste de
  20/10/2026, que mostrou que o endpoint ignora a chave.
- **Reservar o `Pagamento` antes de chamar o Mercado Pago** (a versão do
  monólito): evitava preference órfã, mas exigia espera e `409` em aprovações
  concorrentes e desfazer a reserva quando o Mercado Pago falhava. O Billing
  aceita a preference órfã (inofensiva) em troca de um fluxo sem espera.
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
- Falhas do Mercado Pago não deixam estado: o orçamento só é aprovado depois
  que a cobrança existe.
- Aprovações e notificações concorrentes não duplicam cobrança, evento nem
  atualização.
- A notificação não é confiável por si só: assinatura e reconsulta precisam
  bater, e o valor é conferido em centavos.
- Pagamento atrasado ou duplicado não vira receita fantasma: é estornado sem
  mexer no `Pagamento` original.
- A porta `IGatewayPagamento` e os eventos `PagamentoConfirmado` e
  `PagamentoRecusado` isolam o domínio do Mercado Pago.

## Consequências negativas

- Aprovações concorrentes deixam uma preference órfã no Mercado Pago.
- O Billing publica os eventos só em log até a Feature #326, **sem outbox**:
  se a publicação falhar depois do commit, o evento se perde e a reentrega
  vira "já processado". Nada consome `PagamentoConfirmado` nem
  `PagamentoRecusado` por enquanto.
- Na arquitetura-alvo a OS permanece em `AWAITING_APPROVAL` depois da
  aprovação (o `saga-flow.md` a mantém lá até `PagamentoConfirmado`), e a
  Feature [#334](https://github.com/Async-And-Furious/async-furious-project/issues/334)
  move a transição para `IN_PROGRESS` para o evento `ExecucaoIniciada`. Até
  ela entrar, o monólito ainda leva a OS a `IN_PROGRESS` logo na aprovação,
  antes do pagamento.
- O checklist oficial de qualidade do Mercado Pago aponta campos ausentes na
  preference: `statement_descriptor`, `back_urls`, `category_id` e
  `description` do item, e dados do pagador (fora por decisão, item 3).
- `refunded`, `charged_back` e `in_mediation` são ignorados, então o
  `Pagamento` pode ficar `CONFIRMADO` depois de um estorno feito pelo painel.
- A tabela `webhook_recebido` cresce sem limpeza.

## Riscos

- **Chave de assinatura.** Em 20/10/2026 só a notificação **simulada** pelo
  painel validou com a chave de Webhooks da aplicação principal; as
  notificações de pagamentos reais chegaram assinadas por outra chave. A
  hipótese, **não confirmada**, é que seja a da aplicação do vendedor de teste
  (dono das preferences; comentário de 20/10 na #325). Chave errada: `401` em
  toda notificação (`SignatureMismatch` no log do guard) e `Pagamento` parado
  em `AGUARDANDO_PAGAMENTO`.
- **Refund real não executado** (ver o fallback acima) e **formato do
  offset de `expiration_date_to` não conferido** contra a API real.
- **Segredos e rota em HML.** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e
  `MP_NOTIFICATION_URL` estão nos manifestos do Billing (`billing-secret`,
  `billing-config`), mas ainda faltam no Terraform e nos segredos do GitHub
  Environment. A rota do webhook ainda não está liberada do authorizer no API
  Gateway (Feature #317); sem ela o Mercado Pago não alcança o webhook em HML.
  Também não houve teste ponta a ponta em HML.
- **Valor divergente retido.** Cobrança pendente com valor diferente do
  orçamento não confirma nem estorna; o dinheiro fica retido até alguém agir.

## Em aberto

- Tratar `refunded`/`charged_back`/`in_mediation` (hoje ignorados) e o
  `approved` com **valor divergente** numa cobrança pendente (hoje só log de
  erro).
- Um status persistido de "estorno pendente", caso o refund não funcione no
  sandbox.
- **Estorno por compensação da saga**: o handler de `EtapaDaSagaFalhou`
  (Feature #326).
- Publicação dos eventos de pagamento no Kafka e **outbox** (Feature #326), e
  **quem consome** os eventos e quando a OS sai de `AWAITING_APPROVAL`.
- Limpeza de `webhook_recebido`.
- Terraform e secrets de HML, rota do webhook sem authorizer no Gateway
  (#317) e teste ponta a ponta em HML.
- Remoção do código de pagamento do monólito (Feature #330).

## Histórico

- A primeira implementação foi escrita no monólito (PR #366, módulo
  `financeiro`, 20/10/2026) e **portada para o Billing** (#325). O código do
  monólito sai na #330. Até lá ele diverge do Billing em pontos que esta ADR
  já não descreve:
  - reservava o `Pagamento` antes de chamar o Mercado Pago, com espera e `409`
    em aprovação concorrente, e uma reaprovação sequencial dava `400`;
  - conferia o valor com tolerância em ponto flutuante
    (`processar-notificacao-pagamento.use-case.ts`, linha 70);
  - não estornava pagamento atrasado ou duplicado (só log de erro);
  - `POST /pagamentos/registrar` deixa de criar ou marcar pagamento como
    `PAGO`: só dispara a entrega quando o `Pagamento` da OS está `CONFIRMADO`
    pelo Mercado Pago (`409` caso contrário). Esse evento próprio
    (`PagamentoRegistrado`, fluxo da Fase 3) não é reaproveitado pelo webhook;
  - a migração `20261020150000_pagamento_idempotencia_mercado_pago` cria o
    índice único por OS e falha se um ambiente já tiver mais de um
    `Pagamento` para a mesma OS. O Billing começa vazio e não tem esse risco.
- Em 20/10/2026 o fluxo foi testado localmente com conta de teste: preference
  real, pagamento aprovado (operação #184177738229), notificações assinadas
  **simuladas** com reconsulta real, e concorrência contra o banco local.

## Referências

- [ADR-0011](./0011-aprovacao-orcamento-api-publica.md) — aprovação de
  orçamento e `{ linkPagamento }`
- [ADR-0016](./0016-saga-coreografada.md) e
  [`saga-flow.md`](../architecture/saga-flow.md) — saga e eventos de pagamento
- [ADR-0018](./0018-mensageria-contratos-eventos.md) — contratos de eventos e
  prazo do detector de OS parada
- [ADR-0021](./0021-borda-sem-bff.md) — rota pública do webhook e HMAC
- [`service-order-flow.md`](../architecture/service-order-flow.md) — estado
  atual no monólito
- Código: [`repo-billing`](https://github.com/Async-And-Furious/repo-billing),
  `src/modules/financeiro/` (gateway, webhook, casos de uso) e o README do
  repositório (seções "Integração com o Mercado Pago" e "Estorno (refund) e
  fallback no sandbox"); no monólito, até a #330, o módulo `financeiro` de
  `src/modules/financeiro/`
- Documentação do Mercado Pago: Checkout Pro e Notificações → Webhooks
  (validação da origem da notificação)
