import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { StatusAtualizadoFinalizada } from '../../domain/events/status-atualizado-finalizada.event';
import { ClienteNotificadoConclusao } from '../../domain/events/cliente-notificado-conclusao.event';

@Injectable()
export class NotificarClienteConclusaoPolicy {
  private readonly logger = new Logger(NotificarClienteConclusaoPolicy.name);

  constructor(private readonly emissor: IEmissorEventos) {}

  @OnEvent('StatusAtualizadoFinalizada')
  async handle(evento: StatusAtualizadoFinalizada): Promise<void> {
    this.logger.log(`OS ${evento.ordemServicoId} finalizada — cliente notificado (stub).`);
    await this.emissor.emitir(new ClienteNotificadoConclusao(evento.ordemServicoId));
  }
}
