import { DomainEvent } from '@/shared/domain/events/domain-event.base';

export class BacklogValidadoPecasDisponiveis extends DomainEvent {
  constructor(
    public readonly ordemId: string,
    public readonly pecas: Array<{ pecaId: string; quantidadeNecessaria: number }>
  ) {
    super();
  }
}
