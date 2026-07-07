import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PecasIndisponiveis } from '../../domain/events/pecas-indisponiveis.event';
import { NOTIFICACAO_ADMIN_GATEWAY } from '../ports/notificacao-admin.gateway';
import type { INotificacaoAdminGateway } from '../ports/notificacao-admin.gateway';

@Injectable()
export class NotificarAdminReposicaoHandler {
  constructor(
    @Inject(NOTIFICACAO_ADMIN_GATEWAY)
    private readonly notificacaoAdmin: INotificacaoAdminGateway
  ) {}

  @OnEvent('PecasIndisponiveis')
  async handle(evento: PecasIndisponiveis): Promise<void> {
    await this.notificacaoAdmin.alertar({
      ordemServicoId: evento.ordemServicoId,
      idsPecasIndisponiveis: evento.idsPecasIndisponiveis,
    });
  }
}
