import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EMISSOR_EVENTOS } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { OrdemServicoFinalizada } from '../../domain/events/ordem-servico-finalizada.event';
import { ClienteNotificadoConclusao } from '../../domain/events/cliente-notificado-conclusao.event';
import { NOTIFICACAO_CLIENTE_GATEWAY } from '../ports/notificacao-cliente.gateway';
import type { INotificacaoClienteGateway } from '../ports/notificacao-cliente.gateway';

@Injectable()
export class NotificarClienteConclusaoHandler {
  constructor(
    @Inject(NOTIFICACAO_CLIENTE_GATEWAY)
    private readonly notificacaoGateway: INotificacaoClienteGateway,
    @Inject(EMISSOR_EVENTOS)
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('OrdemServicoFinalizada')
  async handle(evento: OrdemServicoFinalizada): Promise<void> {
    await this.notificacaoGateway.notificar({
      ordemServicoId: evento.ordemServicoId,
      mensagem: 'Seu veículo foi finalizado e está pronto para retirada.',
    });
    await this.emissor.emitir(new ClienteNotificadoConclusao(evento.ordemServicoId));
  }
}
