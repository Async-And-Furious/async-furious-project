import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class EstoqueDebitado extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly pecas: Array<{ id_peca: string; quantidade: number }>
  ) {
    super();
  }
}
