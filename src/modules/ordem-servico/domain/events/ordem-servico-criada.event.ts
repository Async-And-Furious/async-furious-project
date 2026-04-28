import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class OrdemServicoCriada extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly clienteId: string,
    public readonly veiculoId: string,
  ) {
    super();
  }
}
