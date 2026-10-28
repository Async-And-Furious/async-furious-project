import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { PecasIndisponiveis } from '../../../pecas-insumos/domain/events/pecas-indisponiveis.event';

/**
 * PecasIndisponiveis não muda mais o status: a OS segue em AWAITING_APPROVAL e só registra a
 * pendência da reserva. A transição para AWAITING_PARTS acontece em ExecucaoIniciada
 * (AtualizarStatusExecucaoIniciadaHandler).
 */
@Injectable()
export class AtualizarStatusAguardandoPecasHandler {
  private readonly logger = new Logger(AtualizarStatusAguardandoPecasHandler.name);

  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('PecasIndisponiveis')
  async handle(evento: PecasIndisponiveis): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'AWAITING_APPROVAL') {
      this.logger.warn(
        `[P-15] OS ${evento.ordemServicoId} em status inválido para registrar reserva pendente: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      reserva_pecas_pendente: true,
    });
  }
}
