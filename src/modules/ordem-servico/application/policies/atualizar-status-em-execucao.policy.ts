import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OsSemPecasConfirmada } from '../../domain/events/os-sem-pecas-confirmada.event';
import { StatusAtualizadoEmExecucao } from '../../domain/events/status-atualizado-em-execucao.event';

@Injectable()
export class AtualizarStatusEmExecucaoPolicy {
  private readonly logger = new Logger(AtualizarStatusEmExecucaoPolicy.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('OsSemPecasConfirmada')
  async handleSemPecas(evento: OsSemPecasConfirmada): Promise<void> {
    await this.iniciarExecucao(evento.ordemServicoId);
  }

  @OnEvent('PecasReservadas')
  async handlePecasReservadas(evento: { ordemServicoId: string }): Promise<void> {
    await this.iniciarExecucao(evento.ordemServicoId);
  }

  private async iniciarExecucao(ordemServicoId: string): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);
    if (os.status !== 'AWAITING_APPROVAL') {
      this.logger.warn(
        `[P-08] OS ${ordemServicoId} em status inválido para iniciar execução: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(ordemServicoId, { status: 'IN_PROGRESS' });
    await this.emissor.emitir(new StatusAtualizadoEmExecucao(ordemServicoId));
  }
}
