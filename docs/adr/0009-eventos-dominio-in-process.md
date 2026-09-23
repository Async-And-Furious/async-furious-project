# ADR-0009: Comunicação entre Bounded Contexts via eventos de domínio in-process

## Status

Aceita (parcialmente substituída pela [ADR-0016](./0016-saga-coreografada.md)
e pela [ADR-0018](./0018-mensageria-contratos-eventos.md) a partir da
Fase 4 — ver nota abaixo)

> **Nota (Fase 4):** a comunicação **entre** OS Service, Billing Service e
> Execução e Produção passa a usar eventos publicados em um broker externo
> (Kafka, broker, topologia e contrato de evento definidos na
> [ADR-0018](./0018-mensageria-contratos-eventos.md)) e a coordenação
> distribuída segue o modelo de Saga coreografada da
> [ADR-0016](./0016-saga-coreografada.md). Esta ADR continua vigente,
> **sem alteração**, para a comunicação **interna** ao OS Service — em
> particular entre os Bounded Contexts `ordem-servico` e `pecas-insumos`,
> que permanecem no mesmo processo e continuam usando o `EmissorEventos`
> in-process descrito abaixo.

## Contexto

O modelo de domínio (`docs/ddd.md` §5) define 29 eventos de domínio
distribuídos pelos 4 Bounded Contexts de código (`ordem-servico`,
`cadastro`, `pecas-insumos`, `financeiro`). Precisávamos de um
mecanismo para emitir e reagir a esses eventos sem acoplar módulos
diretamente entre si, dentro do escopo acadêmico do projeto (sem
infraestrutura de mensageria externa).

## Decisão

Eventos de domínio são emitidos e tratados **dentro do mesmo processo**,
via uma base própria `DomainEvent` (`src/shared/domain/events/domain-event.base.ts`)
e um publicador `EmissorEventos`
(`src/shared/infrastructure/emissor-eventos/emissor-eventos.service.ts`,
com interface no domínio em `src/shared/domain/interfaces/emissor-eventos.interface.ts`).
Não há message broker externo (Kafka, RabbitMQ, SQS). Listeners de eventos
ficam na camada de infraestrutura, mantendo as políticas de application
livres de framework — mesma regra de dependência unidirecional registrada
em [ADR-0006](./0006-clean-architecture-ddd.md).

## Alternativas consideradas

Nenhuma avaliação formal de message broker externo (Kafka, RabbitMQ, SQS)
está documentada — a escolha por eventos in-process aparece direta, sem
registro de descarte de alternativas, proporcional ao escopo do projeto
(monólito, sem necessidade de comunicação assíncrona entre processos
distintos nas Fases 1/2).

## Consequências positivas

- Módulos reagem a mudanças de outros Bounded Contexts sem import direto
  entre eles — acoplamento via evento, não via chamada direta de serviço.
- Interface de publicador vive no domínio (`IEmissorEventos` ou
  equivalente), respeitando a inversão de dependência da Clean Architecture
  ([ADR-0006](./0006-clean-architecture-ddd.md)).
- Sem infraestrutura externa a operar (broker, filas) — adequado ao escopo
  acadêmico e à ausência de requisito de processamento assíncrono
  distribuído nas Fases 1/2.

## Consequências negativas

- Eventos não sobrevivem a um crash do processo — não há persistência ou
  replay (sem outbox pattern ou equivalente identificado no código).
- Se a Fase 3 evoluir para múltiplos processos/serviços de negócio (não é o
  caso hoje — só autenticação e infraestrutura saem do monólito, ver
  [`docs/architecture/overview.md`](../architecture/overview.md) §4), este
  mecanismo in-process deixa de cobrir comunicação entre eles; nenhuma RFC
  ou ADR encontrada trata dessa evolução, porque ela ainda não é necessária.

## Riscos

- **Baixo, contido pelo escopo atual**: o risco de "eventos in-process não
  escalam para múltiplos processos" só se materializa se/quando a Fase 3
  decidir separar Bounded Contexts de negócio em serviços distintos — o que
  não está decidido nem proposto em nenhuma RFC/ADR hoje.

## Referências

- `src/shared/domain/events/domain-event.base.ts`
- `src/shared/domain/interfaces/emissor-eventos.interface.ts`
- `src/shared/infrastructure/emissor-eventos/emissor-eventos.service.ts`
- [ADR-0006 — Clean Architecture + DDD](./0006-clean-architecture-ddd.md)
- [`docs/ddd.md`](../ddd.md) §5
- `docs/contexto-tecnico-consolidado.md` §8
- [`docs/adr/notas-fases-anteriores.md`](./notas-fases-anteriores.md) (ponto #6)
