import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class VeiculoAnalisado extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
