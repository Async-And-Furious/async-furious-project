import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OrcamentoGerado extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly orcamentoId: string,
  ) {
    super();
  }
}
