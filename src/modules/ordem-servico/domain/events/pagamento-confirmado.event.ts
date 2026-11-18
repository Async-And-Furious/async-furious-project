import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

/** Recebido do Billing por `billing.eventos.v1` (`event-catalog.md`). */
export class PagamentoConfirmado extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly pagamentoId: string
  ) {
    super();
  }
}
