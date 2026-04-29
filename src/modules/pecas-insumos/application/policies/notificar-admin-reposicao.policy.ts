import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PecasIndisponiveis } from '../../domain/events/pecas-indisponiveis.event';

@Injectable()
export class NotificarAdminReposicaoPolicy {
  private readonly logger = new Logger(NotificarAdminReposicaoPolicy.name);

  @OnEvent('PecasIndisponiveis')
  async handle(evento: PecasIndisponiveis): Promise<void> {
    this.logger.warn(
      `OS ${evento.ordemServicoId} com pecas indisponiveis (${evento.idsPecasIndisponiveis.join(', ')}). Acionar reposicao.`
    );
  }
}
