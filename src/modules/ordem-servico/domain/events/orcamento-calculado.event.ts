import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OrcamentoCalculado extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly valorTotalServicos: number,
    public readonly valorTotalPecas: number,
    public readonly valorTotalGeral: number
  ) {
    super();
  }
}
