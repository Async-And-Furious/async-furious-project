import { Injectable, Logger } from '@nestjs/common';
import type {
  INotificacaoAdminGateway,
  NotificacaoAdminPayload,
} from '../../application/ports/notificacao-admin.gateway';

@Injectable()
export class NotificacaoAdminStub implements INotificacaoAdminGateway {
  private readonly logger = new Logger(NotificacaoAdminStub.name);

  async alertar(payload: NotificacaoAdminPayload): Promise<void> {
    this.logger.warn(
      `[STUB] Alerta admin — OS ${payload.ordemServicoId} com peças indisponíveis: ${payload.idsPecasIndisponiveis.join(', ')}`
    );
  }
}
