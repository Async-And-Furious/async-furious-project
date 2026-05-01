import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

export class PecasIndisponiveis extends DomainEvent {
  constructor(
    public readonly ordemServicoId: string,
    public readonly idsPecasIndisponiveis: string[]
  ) {
    super();
  }
}
