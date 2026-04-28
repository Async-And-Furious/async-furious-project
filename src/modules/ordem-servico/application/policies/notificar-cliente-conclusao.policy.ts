import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BarramentoEventos } from '../../../../shared/infrastructure/barramento-eventos/barramento-eventos.service';
import { StatusAtualizadoFinalizada } from '../../domain/events/status-atualizado-finalizada.event';
import { ClienteNotificadoConclusao } from '../../domain/events/cliente-notificado-conclusao.event';

@Injectable()
export class NotificarClienteConclusaoPolicy {
  constructor(private readonly barramento: BarramentoEventos) {}

  @OnEvent('StatusAtualizadoFinalizada')
  async handle(evento: StatusAtualizadoFinalizada): Promise<void> {
    // Stub: In a full system, would dispatch notification/email to client
    console.log(
      `[NotificarClienteConclusao] OS ${evento.ordemServicoId} finalizada — cliente notificado (stub).`,
    );
    await this.barramento.emitir(new ClienteNotificadoConclusao(evento.ordemServicoId));
  }
}
