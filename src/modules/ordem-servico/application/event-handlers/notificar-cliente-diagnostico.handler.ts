import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatusAtualizadoEmDiagnostico } from '../../domain/events/status-atualizado-em-diagnostico.event';

@Injectable()
export class NotificarClienteDiagnosticoHandler {
  private readonly logger = new Logger(NotificarClienteDiagnosticoHandler.name);

  @OnEvent('StatusAtualizadoEmDiagnostico')
  handle(evento: StatusAtualizadoEmDiagnostico): void {
    this.logger.log(`OS ${evento.ordemServicoId} em diagnóstico — cliente notificado (stub).`);
  }
}
