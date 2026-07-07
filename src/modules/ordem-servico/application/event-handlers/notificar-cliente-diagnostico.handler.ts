import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrdemServicoEmDiagnostico } from '../../domain/events/ordem-servico-em-diagnostico.event';

@Injectable()
export class NotificarClienteDiagnosticoHandler {
  private readonly logger = new Logger(NotificarClienteDiagnosticoHandler.name);

  @OnEvent('OrdemServicoEmDiagnostico')
  handle(evento: OrdemServicoEmDiagnostico): void {
    this.logger.log(`OS ${evento.ordemServicoId} em diagnóstico — cliente notificado (stub).`);
  }
}
