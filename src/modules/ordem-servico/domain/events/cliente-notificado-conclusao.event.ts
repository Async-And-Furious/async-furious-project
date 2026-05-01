import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class ClienteNotificadoConclusao extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
