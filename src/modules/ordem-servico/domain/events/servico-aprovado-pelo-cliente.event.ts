import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class ServicoAprovadoPeloCliente extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
