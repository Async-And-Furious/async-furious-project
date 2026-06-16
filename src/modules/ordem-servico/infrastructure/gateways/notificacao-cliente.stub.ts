import { Injectable, Logger } from '@nestjs/common';
import type {
  INotificacaoClienteGateway,
  NotificacaoClientePayload,
} from '../../application/ports/notificacao-cliente.gateway';

@Injectable()
export class NotificacaoClienteStub implements INotificacaoClienteGateway {
  private readonly logger = new Logger(NotificacaoClienteStub.name);

  async notificar(payload: NotificacaoClientePayload): Promise<void> {
    this.logger.log(
      `[STUB] Notificação ao cliente — OS ${payload.ordemServicoId}: ${payload.mensagem}`
    );
  }
}
