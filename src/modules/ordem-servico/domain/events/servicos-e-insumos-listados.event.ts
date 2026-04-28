import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class ServicosEInsumosListados extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly valorTotalServicos: number,
    public readonly valorTotalPecas: number,
  ) {
    super();
  }
}
