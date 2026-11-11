# ADR-0016: Saga coreografada para a transação distribuída da Fase 4

## Status

Aceita

## Contexto

A Fase 4 exige a refatoração do monólito modular atual em, no mínimo, três
microsserviços independentes (`12SOAT - Fase 4 - Tech challenge.pdf`, p.2),
cada um com banco de dados próprio. O fluxo de abertura e acompanhamento de
uma Ordem de Serviço, hoje uma transação síncrona dentro de um único
processo — eventos de domínio emitidos e tratados in-process via
`EmissorEventos` ([ADR-0009](./0009-eventos-dominio-in-process.md)) —, passa
a atravessar fronteiras de serviço: **OS Service** (herda `ordem-servico`,
`cadastro` e `pecas-insumos`), **Billing Service** (herda `financeiro` e
passa a ser dono do `Orcamento`) e **Execução e Produção** (serviço novo).
A divisão exata de ownership de tabelas foi formalizada pela Feature
"Definir Divisão de Microsserviços e Ownership de Dados" (issue #307),
registrada em
[ADR-0017](./0017-divisao-microsservicos-ownership-dados.md) e
[`service-boundaries.md`](../architecture/service-boundaries.md). Os nomes
dos três serviços usados nesta ADR são os mesmos adotados por aquela
Feature. Dessa divisão, duas decisões afetam diretamente o desenho da saga:
o **OS Service calcula o orçamento** (mantém o diagnóstico e os itens de
serviço/peça sob sua fronteira), enquanto o **Billing Service gera e
persiste o documento de orçamento** e atende às rotas públicas de
aprovação/recusa ([ADR-0011](./0011-aprovacao-orcamento-api-publica.md),
revisada pela Feature #307).

Sem coordenação de transação distribuída, uma falha em qualquer etapa
(orçamento recusado, pagamento recusado, falha técnica em alguma etapa)
deixaria os três serviços em estados inconsistentes entre si — o enunciado
exige explicitamente "rollback e compensação no caso de falha em qualquer
etapa" (p.4) e cobra a descrição da estratégia escolhida tanto no README
quanto no PDF de entrega (p.4 e p.6), além de demonstração em vídeo da
"Execução do Saga Pattern e tratamento de falhas" (p.5).

Decisão fechada pelo grupo em 21/09/2026, registrada em
`fase4-decisoes-epico1.md` §F2 (workspace local do grupo, fora do
repositório).

## Decisão

A transação distribuída da Fase 4 usa **Saga coreografada**: não existe
orquestrador central nem um serviço/repositório coordenador. Cada serviço
publica os eventos de domínio que dizem respeito à sua própria fronteira e
reage aos eventos publicados pelos outros dois, decidindo e executando a
própria compensação quando um evento de falha chega.

**Escopo do fluxo coberto pela saga:**

```
Abrir OS → diagnóstico → orçamento → aprovação → pagamento → execução (início do reparo e conclusão)
```

- O **pagamento entra como etapa obrigatória** da saga, logo após a
  aprovação do orçamento pelo cliente e **antes** do início da execução
  (`IN_PROGRESS`) — sem ele, o Billing Service ficaria de fora da transação
  distribuída, apesar de ser um dos três serviços do desenho. O pagamento é
  **assíncrono** (Checkout Pro, confirmação por webhook do Mercado Pago, ver
  issue #325): enquanto espera, a OS permanece em `AWAITING_APPROVAL`.
- O **Execução e Produção participa em duas filas** (modelo híbrido mínimo,
  alinhado ao enunciado, p.3: "gerenciar a fila de execução da OS",
  "atualizar status durante diagnóstico e reparos" e "comunicar finalização
  ao OS Service"). Consome `OrdemServicoRecebida` e cria a `Execucao` em
  `AGUARDANDO_DIAGNOSTICO`; o mecânico inicia o diagnóstico
  (`DiagnosticoIniciado`), o reparo (`ExecucaoIniciada`) e a conclusão
  (`ExecucaoConcluida`) por rotas do próprio serviço. Consome
  `PagamentoConfirmado` (leva a `AGUARDANDO_REPARO`, sem publicar evento) e
  cancela a `Execucao` nas recusas e em `EtapaDaSagaFalhou`. Listar
  serviços/peças e calcular o orçamento ficam no OS Service
  (`PATCH /api/v1/ordens-servico/{id}/servicos-insumos`), porque dependem de
  `Servico` e `Peca`.
- A **entrega fica fora do escopo da saga**: é um ato presencial
  (`PATCH /ordens-servico/:id/registrar-entrega`, disparado pela
  recepcionista com o cliente físicamente presente), sem contrapartida
  assíncrona entre serviços a coordenar.
- **Resolução da divergência sinalizada pela Feature #307**: a Feature #307
  registrou, sem decidir, uma aparente divergência entre "pagamento como
  pré-requisito da entrega" (regra definida em
  [`service-order-flow.md`](../architecture/service-order-flow.md#integração-com-o-contexto-financeiro-fase-4))
  e "pagamento como etapa da saga logo após a aprovação" (F2/2.2), chegando
  a cogitar dois momentos de cobrança — risco registrado como médio, não
  resolvido, em [ADR-0017](./0017-divisao-microsservicos-ownership-dados.md)
  ("Riscos") e como pendência de validação em `service-boundaries.md` §6,
  item 2. Esta ADR fecha essa pendência: **há um único pagamento**, cobrado
  logo após a aprovação do orçamento, como etapa da saga. A checagem de
  "pagamento confirmado" antes de `registrar-entrega` (prevista na decisão
  de 22/09/2026) foi **cortada na revisão de 30/09/2026**: o `Pagamento` é
  do Billing Service (o OS Service guarda só o marcador `pago_em`), e
  `FINISHED` só é alcançável depois de `ExecucaoConcluida`, que só existe
  depois de `iniciar-reparo`, que só é possível depois de
  `PagamentoConfirmado` — a checagem seria sempre verdadeira e exigiria
  chamada REST entre serviços, que a Fase 4 não tem.
- O detalhamento passo a passo (serviço executor, evento publicado, evento
  consumido) e a matriz `etapa → falha → compensação` estão em
  [`docs/architecture/saga-flow.md`](../architecture/saga-flow.md), não
  duplicados aqui.

**Natureza da compensação:** lógica por padrão — **liberar a reserva de
peças**, marcar orçamento/OS como encerrados sem execução. O estorno real no
Mercado Pago só é acionado **se o pagamento já tiver sido capturado** pelo
gateway antes da falha que dispara a compensação (ex.: falha técnica em
`inicio-execucao` depois do `PagamentoConfirmado`, ou pagamento confirmado
que chega depois do prazo de pagamento). Se a falha ocorre antes da captura
(ex.: orçamento recusado, `PagamentoRecusado`, pagamento nunca confirmado), a
compensação é puramente lógica, sem chamada ao Mercado Pago. Falha técnica
em `reparo` (OS não processou `ExecucaoIniciada` ou `ExecucaoConcluida`) não
compensa: o mecânico já está trabalhando ou já terminou, e o caso é
tratado manualmente. A matriz completa está em `saga-flow.md` §3.

**Rastreabilidade sem estado central:** como não há orquestrador, não existe
um documento único com "o estado da saga" em um dado momento. A evidência
de que a saga avançou (ou compensou) corretamente passa a ser a combinação
de três mecanismos, nenhum deles novo em relação ao que o projeto já usa:

1. **Trace distribuído no New Relic** — instrumentação tratada pelo épico
   de Observabilidade da Fase 4, fora do escopo desta ADR.
2. **`correlationId` propagado no envelope de evento** — é sempre o
   `ordemServicoId` (regra determinística: qualquer serviço o calcula),
   viajando de evento em evento entre os três serviços. Não é o
   `x-correlation-id` HTTP da Fase 3 (Authorizer/Gateway/Pino), que passa a
   ser só o id de requisição nos logs. O formato exato do envelope está na
   [ADR-0018](./0018-mensageria-contratos-eventos.md).
3. **`HistoricoStatusOS.motivo`** (`prisma/schema.prisma`, model já
   existente) — cada transição de status da OS, incluindo as motivadas por
   compensação, é registrada com o motivo em texto, permanecendo a fonte de
   verdade local de "o que aconteceu com esta OS" dentro do OS Service.

## Alternativas consideradas

- **Orquestração com um orquestrador central e repositório/serviço
  próprio.** Recusada. Um quarto componente dedicado só a coordenar a saga
  adicionaria um repositório, uma infraestrutura e um ponto único de falha
  a mais no cronograma de 8 semanas, sem que o enunciado exija
  orquestração — ele lista orquestração e coreografia como opções
  equivalentes (p.4). Um orquestrador central também mudaria o dono do
  banco NoSQL obrigatório (p.3): em vez de ele nascer com um propósito de
  negócio real (read model de OS e Cliente, ver decisão CQRS do Epic 1),
  seria alocado por eliminação a um serviço que só existiria para coordenar.
- **Orquestração como módulo dentro do OS Service, sem repositório
  separado.** Também recusada, por uma razão diferente: mesmo sem repo
  próprio, um orquestrador embutido faria do OS Service um ponto central de
  decisão sobre o Billing Service e o Execução e Produção — o tipo de
  acoplamento que a divisão em microsserviços busca evitar (nenhum serviço
  deve decidir o estado interno de outro). A coreografia mantém cada
  serviço dono da própria máquina de estados.

## Consequências positivas

- Nenhum componente novo de infraestrutura dedicado a orquestração — reduz
  o número de partes móveis num cronograma de 8 semanas.
- Cada serviço permanece dono exclusivo da própria transição de estado;
  nenhum serviço comanda o estado interno de outro, reforçando o isolamento
  que a divisão em microsserviços já busca (p.4 do enunciado: "Nenhum
  serviço pode acessar diretamente o banco de outro serviço").
- Acoplamento entre serviços fica restrito ao contrato de evento
  (nome, payload, `correlationId`) — não a uma API de coordenação central.
- Fecha a divergência que a Feature #307 havia sinalizado e deixado em
  aberto (ver "Decisão" acima) entre a regra de pagamento→entrega e a
  sequência de saga — sem precisar de um segundo momento de cobrança.

## Consequências negativas

- **Compensação espalhada por três serviços**, em vez de concentrada num
  único orquestrador — cada serviço precisa implementar e testar a própria
  reação a eventos de falha. Mitigado por dois entregáveis fora desta ADR,
  ambos previstos no épico de Saga: a matriz `etapa → falha → compensação`
  (já esboçada em `docs/architecture/saga-flow.md`) e um cenário BDD do
  fluxo completo, incluindo ao menos um caminho de falha.
- **Sem estado único da saga**: reconstruir "o que aconteceu com esta OS"
  exige cruzar três fontes (trace distribuído, `correlationId` nos eventos,
  `HistoricoStatusOS.motivo`) em vez de consultar um único registro central.
  Aceito conscientemente pelo grupo em troca de não introduzir um
  orquestrador.
- **Sem transação distribuída forte**: a garantia é de consistência
  eventual, não atomicidade — entre a falha numa etapa e a compensação
  correspondente ser processada pelos serviços interessados existe uma
  janela onde os serviços estão temporariamente inconsistentes entre si.

## Riscos

- **Médio**: a corretude da saga depende inteiramente de cada serviço
  consumir e tratar corretamente os eventos de falha dos outros dois — não
  há um componente central que force isso. Erro de implementação em um
  consumidor de evento de compensação passa despercebido sem
  instrumentação adequada (mitigado pelo épico de Observabilidade, fora
  do escopo desta ADR).
- **Baixo, aceito conscientemente**: dependência do Mercado Pago em modo
  sandbox para o cenário de estorno real. Por isso a compensação é lógica
  por padrão, reduzindo a superfície de dependência externa nos testes de
  falha que não envolvem pagamento já capturado.
- **Baixo, aceito conscientemente (decisão, não mais pendência)**: não há
  status novo no `SOStatus`. Todas as compensações da saga encerram a OS
  reaproveitando `CLOSED_WITHOUT_EXECUTION`, e a espera pelo pagamento
  reaproveita `AWAITING_APPROVAL`. O motivo específico de cada falha, e a
  distinção "aprovado e aguardando pagamento", ficam em
  `HistoricoStatusOS.motivo`. Custo aceito: o tempo médio em
  `AWAITING_APPROVAL` soma a espera de aprovação e a de pagamento, e
  relatórios por status não distinguem o motivo do encerramento sem ler o
  histórico.

## Revisão de 30/09/2026

Revisão do épico #306 (`rev/Epic_1`). A decisão central (coreografia, sem
orquestrador) **continua valendo**; mudou o desenho do fluxo, agora
detalhado em [`saga-flow.md`](../architecture/saga-flow.md) como fonte
única:

- Fluxo passa a terminar na **conclusão** da execução (novo evento
  `ExecucaoConcluida`, que leva a OS a `FINISHED`), não mais no início.
- Execução e Produção em **modelo híbrido mínimo**: consome
  `OrdemServicoRecebida` (fila de diagnóstico) e `PagamentoConfirmado` (fila
  de reparo); o mecânico chama `iniciar-diagnostico` (publica
  `DiagnosticoIniciado`, OS vai a `UNDER_DIAGNOSIS`), `iniciar-reparo`
  (publica `ExecucaoIniciada`, OS vai a `IN_PROGRESS`/`AWAITING_PARTS`) e
  `concluir` (publica `ExecucaoConcluida`, OS vai a `FINISHED`). Ciclo:
  `AGUARDANDO_DIAGNOSTICO` → `EM_DIAGNOSTICO` → `AGUARDANDO_REPARO` →
  `EM_REPARO` → `CONCLUIDA`; `CANCELADA` a partir de qualquer não terminal
  (recusas e `EtapaDaSagaFalhou`). `assumir`/`analisar` e
  `finalizar-execucao` saem do OS Service; `servicos-insumos` fica. Ficam
  fora da Fase 4: pausa por falta de peça no Execução, rejeição de
  apontamento e reposição.
- Como o reparo começa por ação do mecânico, uma OS paga pode esperar na
  fila de reparo além do prazo do detector: o OS Service consome
  `PagamentoConfirmado` só para gravar `pago_em` (sem mudar o status) e o
  detector só considera OS em `AWAITING_APPROVAL` com `pago_em` nulo.
- Falhas técnicas ganham `etapa=diagnostico`; `inicio-execucao` passa a
  cobrir `PagamentoConfirmado` (Execução) e `ExecucaoIniciada` (OS). A
  matriz ganhou a tabela "evento original → etapa" para a DLT.
- **Reserva de estoque** no OS Service ao consumir `OrcamentoAprovado`; a
  OS não vai a `IN_PROGRESS` ao reservar (quem faz isso é
  `ExecucaoIniciada`). A compensação de `PagamentoRecusado` **libera a
  reserva** (operação nova).
- Falhas: recusas de negócio com evento próprio (`OrcamentoRecusado`,
  `PagamentoRecusado`) e **um único** evento técnico, `EtapaDaSagaFalhou`,
  com o campo `etapa` (ver [ADR-0018](./0018-mensageria-contratos-eventos.md)).
  Somem `OrcamentoGeracaoFalhou` e `ExecucaoInicioFalhou`.
- OS permanece em `AWAITING_APPROVAL` enquanto espera o pagamento; o risco
  "status distinto para compensação" virou decisão de **não criar status
  novo** (reaproveita `CLOSED_WITHOUT_EXECUTION` e `AWAITING_APPROVAL`).
- Pagamento assíncrono via Mercado Pago (Checkout Pro, webhook HMAC +
  reconsulta); `PagamentoRecusado` só para status terminal.
- Exemplo de estorno real deixa de ser "peça indisponível depois do
  pagamento" e passa a ser falha técnica em `inicio-execucao` ou pagamento
  fora do prazo.
- Removidos os textos transitórios sobre a Feature #307 "ainda não
  mesclada".
- `correlationId` = `ordemServicoId` em todos os eventos (não mais o
  `x-correlation-id` do Authorizer, que vira só id de requisição).
- Checagem de pagamento em `registrar-entrega` **cortada** (ver "Decisão").
- Zero chamada REST entre serviços: toda a coordenação é por evento.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.2, p.4, p.5 e p.6
- `fase4-decisoes-epico1.md` (workspace local do grupo), §F2
- [ADR-0009 — Eventos de domínio in-process](./0009-eventos-dominio-in-process.md)
- [`docs/architecture/saga-flow.md`](../architecture/saga-flow.md)
- [`docs/architecture/service-order-flow.md`](../architecture/service-order-flow.md)
- [`docs/ddd.md`](../ddd.md) §5 — catálogo de eventos de domínio existentes
- `prisma/schema.prisma` — enum `SOStatus`, model `HistoricoStatusOS`
- Issue #307 — Definir Divisão de Microsserviços e Ownership de Dados
- [ADR-0017 — Divisão em três microsserviços e ownership de dados](./0017-divisao-microsservicos-ownership-dados.md)
- [`docs/architecture/service-boundaries.md`](../architecture/service-boundaries.md) §6 (pendências de validação)
- [ADR-0011 — Aprovação de orçamento via API pública síncrona](./0011-aprovacao-orcamento-api-publica.md) (revisada pela Feature #307)
- Issue #309 — Definir Mensageria e Contratos de Eventos
