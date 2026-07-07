import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { OrdemServicoFinalizada } from '../../domain/events/ordem-servico-finalizada.event';
import { ClienteNotificadoConclusao } from '../../domain/events/cliente-notificado-conclusao.event';

@Injectable()
export class NotificarClienteConclusaoHandler {
  private readonly logger = new Logger(NotificarClienteConclusaoHandler.name);

  constructor(private readonly emissor: IEmissorEventos) {}

  @OnEvent('OrdemServicoFinalizada')
  async handle(evento: OrdemServicoFinalizada): Promise<void> {
    this.logger.log(`OS ${evento.ordemServicoId} finalizada — cliente notificado (stub).`);
    await this.emissor.emitir(new ClienteNotificadoConclusao(evento.ordemServicoId));
  }
}
