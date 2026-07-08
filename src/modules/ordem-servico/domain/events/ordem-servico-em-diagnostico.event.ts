import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OrdemServicoEmDiagnostico extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
