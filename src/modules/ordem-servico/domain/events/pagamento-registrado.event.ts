import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class PagamentoRegistrado extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly pagamentoId?: string
  ) {
    super();
  }
}
