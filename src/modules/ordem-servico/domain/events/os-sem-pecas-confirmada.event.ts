import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OsSemPecasConfirmada extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
