import { DomainEvent } from './domain-event.base';

export type SagaEtapa =
  | 'diagnostico'
  | 'orcamento'
  | 'aprovacao-pagamento'
  | 'inicio-execucao'
  | 'reparo';

export class EtapaDaSagaFalhou extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly etapa: SagaEtapa,
    public readonly motivo: string,
    public readonly eventIdOriginal?: string
  ) {
    super();
  }
}

export class SagaCompleted extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly compensacoes: string[]
  ) {
    super();
  }
}
