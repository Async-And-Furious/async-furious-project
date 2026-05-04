import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { PecasIndisponiveis } from '../../../pecas-insumos/domain/events/pecas-indisponiveis.event';
import { StatusAtualizadoAguardandoPecas } from '../../domain/events/status-atualizado-aguardando-pecas.event';

@Injectable()
export class AtualizarStatusAguardandoPecasPolicy {
  private readonly logger = new Logger(AtualizarStatusAguardandoPecasPolicy.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
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
