import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SagaCompensationService } from '../application/saga-compensation.service';
import { EtapaDaSagaFalhou } from '../domain/events/saga-compensation.events';
import { OrcamentoRecusado } from '../../modules/ordem-servico/domain/events/orcamento-recusado.event';

@Injectable()
export class SagaCompensationHandler {
  constructor(private readonly service: SagaCompensationService) {}

  @OnEvent('EtapaDaSagaFalhou')
  async handleFailure(event: EtapaDaSagaFalhou): Promise<void> {
    await this.service.compensate(event);
  }

  @OnEvent('OrcamentoRecusado')
  async handleBudgetRefusal(event: OrcamentoRecusado): Promise<void> {
    await this.service.compensateRefusal(event.ordemServicoId, 'OrcamentoRecusado', event.eventId);
  }
}
