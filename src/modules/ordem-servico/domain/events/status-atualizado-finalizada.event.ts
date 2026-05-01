import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class StatusAtualizadoFinalizada extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
