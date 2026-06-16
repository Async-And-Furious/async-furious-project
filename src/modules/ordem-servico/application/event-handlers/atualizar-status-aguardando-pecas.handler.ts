import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { PecasIndisponiveis } from '../../../pecas-insumos/domain/events/pecas-indisponiveis.event';
import { StatusAtualizadoAguardandoPecas } from '../../domain/events/status-atualizado-aguardando-pecas.event';

@Injectable()
export class AtualizarStatusAguardandoPecasHandler {
  private readonly logger = new Logger(AtualizarStatusAguardandoPecasHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('PecasIndisponiveis')
  async handle(evento: PecasIndisponiveis): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'AWAITING_APPROVAL') {
      this.logger.warn(
        `[P-15] OS ${evento.ordemServicoId} em status inválido para aguardar peças: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'AWAITING_PARTS' });
    await this.emissor.emitir(new StatusAtualizadoAguardandoPecas(evento.ordemServicoId));
  }
}
