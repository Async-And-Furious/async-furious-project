import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class StatusAtualizadoEntregue extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
