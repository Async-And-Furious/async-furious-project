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
A divisão exata de ownership de tabelas foi formalizada em paralelo pela
Feature "Definir Divisão de Microsserviços e Ownership de Dados" (issue
#307, publicada em `feat/I-307_DefinirDivisaoMicrosservicosOwnershipDados`,
ainda não mesclada em `develop` no momento desta revisão), registrada em
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
(orçamento recusado, pagamento não confirmado, indisponibilidade de peça)
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
Abrir OS → orçamento → aprovação → pagamento → execução iniciada
```

- O **pagamento entra como etapa obrigatória** da saga, logo após a
  aprovação do orçamento pelo cliente e **antes** do início da execução
  (`IN_PROGRESS`) — sem ele, o Billing Service ficaria de fora da transação
  distribuída, apesar de ser um dos três serviços do desenho.
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
  "pagamento confirmado" antes de `registrar-entrega` não é um segundo
  momento de cobrança — é uma **trava de segurança** sobre o mesmo
  pagamento já capturado etapas antes no fluxo (a entrega só é possível
  depois de `FINISHED`, que por sua vez só existe porque a execução foi
  iniciada, o que só acontece após o pagamento confirmado). Se o pagamento
  não tivesse sido confirmado, a OS já teria sido compensada e encerrada
  muito antes de chegar a `registrar-entrega` — a checagem na entrega nunca
  encontra, na prática, um pagamento pendente.
- O detalhamento passo a passo (serviço executor, evento publicado, evento
  consumido) e a matriz `etapa → falha → compensação` estão em
  [`docs/architecture/saga-flow.md`](../architecture/saga-flow.md), não
  duplicados aqui.

**Natureza da compensação:** lógica por padrão — reverter status da OS,
cancelar reserva de peça, marcar orçamento/OS como encerrados sem execução.
O estorno real no Mercado Pago só é acionado **se o pagamento já tiver sido
capturado** pelo gateway antes da falha que dispara a compensação (ex.:
peça fica indisponível depois do pagamento confirmado). Se a falha ocorre
antes da captura (ex.: orçamento recusado, pagamento nunca chega a ser
confirmado), a compensação é puramente lógica, sem chamada ao Mercado Pago.

**Rastreabilidade sem estado central:** como não há orquestrador, não existe
um documento único com "o estado da saga" em um dado momento. A evidência
de que a saga avançou (ou compensou) corretamente passa a ser a combinação
de três mecanismos, nenhum deles novo em relação ao que o projeto já usa:

1. **Trace distribuído no New Relic** — instrumentação tratada pelo épico
   de Observabilidade da Fase 4, fora do escopo desta ADR.
2. **`correlationId` propagado no envelope de evento** — o mesmo
   identificador de correlação já usado nos logs e no Lambda Authorizer da
   Fase 3, agora viajando de evento em evento entre os três serviços. O
   formato exato do envelope é definido na Feature de Mensageria
   (issue #309); esta ADR só fixa que o `correlationId` deve nascer na
   abertura da OS e atravessar toda a cadeia de eventos do fluxo acima.
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
  sequência de saga — sem precisar de um segundo momento de cobrança nem de
  mudança na regra já registrada em `service-order-flow.md`.

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
- **Fora de escopo desta ADR, registrado para decisão futura**: todas as
  compensações da saga encerram a OS reaproveitando o status já existente
  `CLOSED_WITHOUT_EXECUTION` (`SOStatus` em `prisma/schema.prisma`, hoje usado
  para orçamento recusado). O motivo específico de cada falha fica em
  `HistoricoStatusOS.motivo`. Se a implementação (issue #337, épico de Saga)
  precisar diferenciar falhas por status, a mudança de schema é decidida lá,
  não por este card de documentação.

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
