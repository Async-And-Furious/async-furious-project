import { DomainEvent } from '@/shared/domain/events/domain-event.base';

export class PedidoFornecedorEnviado extends DomainEvent {
  constructor(
    public readonly pedidoId: string,
    public readonly fornecedorId: string,
    public readonly pecas: Array<{ pecaId: string; quantidadeSolicitada: number }>
  ) {
    super();
  }
}
