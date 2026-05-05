import { DomainEvent } from '@/shared/domain/events/domain-event.base';

export class EstoqueAtualizadoAposRecebimento extends DomainEvent {
  constructor(public readonly pecasAtualizadas: Array<{ pecaId: string; novaQuantidade: number }>) {
    super();
  }
}
