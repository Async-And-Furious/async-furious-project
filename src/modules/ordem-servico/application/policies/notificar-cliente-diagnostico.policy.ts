import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatusAtualizadoEmDiagnostico } from '../../domain/events/status-atualizado-em-diagnostico.event';

@Injectable()
export class NotificarClienteDiagnosticoPolicy {
  @OnEvent('StatusAtualizadoEmDiagnostico')
  async handle(evento: StatusAtualizadoEmDiagnostico): Promise<void> {
    // Stub: In a full system, would dispatch notification to client
    // Will integrate with notification module when available
    console.log(
      `[NotificarClienteDiagnostico] OS ${evento.ordemServicoId} em diagnóstico — cliente notificado (stub).`,
    );
  }
}
