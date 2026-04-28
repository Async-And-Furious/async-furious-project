import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatusAtualizadoEmDiagnostico } from '../../domain/events/status-atualizado-em-diagnostico.event';

@Injectable()
export class NotificarClienteDiagnosticoPolicy {
  @OnEvent('StatusAtualizadoEmDiagnostico')
  handle(evento: StatusAtualizadoEmDiagnostico): void {
    console.log(
      `[NotificarClienteDiagnostico] OS ${evento.ordemServicoId} em diagnóstico — cliente notificado (stub).`
    );
  }
}
