import { DomainEvent } from '@/shared/domain/events/domain-event.base';

export class PecasRecebidas extends DomainEvent {
  constructor(
    public readonly pedidoId: string,
    public readonly pecasRecebidas: Array<{ pecaId: string; quantidadeRecebida: number }>
  ) {
    super();
  }
}
