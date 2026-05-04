import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { StatusAtualizadoFinalizada } from '../../domain/events/status-atualizado-finalizada.event';
import { ClienteNotificadoConclusao } from '../../domain/events/cliente-notificado-conclusao.event';

@Injectable()
export class NotificarClienteConclusaoPolicy {
  private readonly logger = new Logger(NotificarClienteConclusaoPolicy.name);

  constructor(private readonly emissor: EmissorEventos) {}

  @OnEvent('StatusAtualizadoFinalizada')
  async handle(evento: StatusAtualizadoFinalizada): Promise<void> {
    this.logger.log(`OS ${evento.ordemServicoId} finalizada — cliente notificado (stub).`);
    await this.emissor.emitir(new ClienteNotificadoConclusao(evento.ordemServicoId));
  }
}
