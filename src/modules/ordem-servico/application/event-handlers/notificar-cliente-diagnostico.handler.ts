import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatusAtualizadoEmDiagnostico } from '../../domain/events/status-atualizado-em-diagnostico.event';
import { NOTIFICACAO_CLIENTE_GATEWAY } from '../ports/notificacao-cliente.gateway';
import type { INotificacaoClienteGateway } from '../ports/notificacao-cliente.gateway';

@Injectable()
export class NotificarClienteDiagnosticoHandler {
  constructor(
    @Inject(NOTIFICACAO_CLIENTE_GATEWAY)
    private readonly notificacaoGateway: INotificacaoClienteGateway
  ) {}

  @OnEvent('StatusAtualizadoEmDiagnostico')
  async handle(evento: StatusAtualizadoEmDiagnostico): Promise<void> {
    await this.notificacaoGateway.notificar({
      ordemServicoId: evento.ordemServicoId,
      mensagem: 'Seu veículo está em diagnóstico.',
    });
  }
}
