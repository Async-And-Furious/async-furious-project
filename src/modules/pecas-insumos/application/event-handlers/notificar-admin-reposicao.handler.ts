import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PecasIndisponiveis } from '../../domain/events/pecas-indisponiveis.event';

@Injectable()
export class NotificarAdminReposicaoHandler {
  private readonly logger = new Logger(NotificarAdminReposicaoHandler.name);

  @OnEvent('PecasIndisponiveis')
  handle(evento: PecasIndisponiveis): void {
    this.logger.warn(
      `OS ${evento.ordemServicoId} com pecas indisponiveis (${evento.idsPecasIndisponiveis.join(', ')}). Acionar reposicao.`
    );
  }
}
