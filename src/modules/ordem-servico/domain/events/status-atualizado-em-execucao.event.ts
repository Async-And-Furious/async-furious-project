import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class StatusAtualizadoEmExecucao extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
