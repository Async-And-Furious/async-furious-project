import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrdemServicoEmDiagnostico } from '../../domain/events/ordem-servico-em-diagnostico.event';
import { NOTIFICACAO_CLIENTE_GATEWAY } from '../ports/notificacao-cliente.gateway';
import type { INotificacaoClienteGateway } from '../ports/notificacao-cliente.gateway';

@Injectable()
export class NotificarClienteDiagnosticoHandler {
  constructor(
    @Inject(NOTIFICACAO_CLIENTE_GATEWAY)
    private readonly notificacaoGateway: INotificacaoClienteGateway
  ) {}

  @OnEvent('OrdemServicoEmDiagnostico')
  async handle(evento: OrdemServicoEmDiagnostico): Promise<void> {
    await this.notificacaoGateway.notificar({
      ordemServicoId: evento.ordemServicoId,
      mensagem: 'Seu veículo está em diagnóstico.',
    });
  }
}
