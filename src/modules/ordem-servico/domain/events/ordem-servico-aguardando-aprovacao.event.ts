import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OrdemServicoAguardandoAprovacao extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
