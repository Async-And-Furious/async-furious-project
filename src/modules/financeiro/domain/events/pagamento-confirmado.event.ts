import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class PagamentoConfirmadoEvent extends DomainEvent {
  constructor(
    public readonly pagamentoId: string,
    public readonly ordemServicoId: string
  ) {
    super();
  }
}
