import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OrdemServicoEmExecucao extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
