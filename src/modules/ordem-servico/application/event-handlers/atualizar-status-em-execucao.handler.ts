import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OsSemPecasConfirmada } from '../../domain/events/os-sem-pecas-confirmada.event';
import { StatusAtualizadoEmExecucao } from '../../domain/events/status-atualizado-em-execucao.event';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';

@Injectable()
export class AtualizarStatusEmExecucaoHandler {
  private readonly logger = new Logger(AtualizarStatusEmExecucaoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('OsSemPecasConfirmada')
  async handleSemPecas(evento: OsSemPecasConfirmada): Promise<void> {
    await this.iniciarExecucao(evento.ordemServicoId, ['AWAITING_APPROVAL']);
  }

  // PecasReservadas vem de dois lugares:
  // 1. DebitarEstoqueHandler (peças disponíveis imediatamente) → OS em AWAITING_APPROVAL
  // 2. LiberarOrdensAguardandoPecasHandler (peças recebidas do fornecedor) → OS em AWAITING_PARTS
  @OnEvent('PecasReservadas')
  async handlePecasReservadas(evento: { ordemServicoId: string }): Promise<void> {
    await this.iniciarExecucao(evento.ordemServicoId, ['AWAITING_APPROVAL', 'AWAITING_PARTS']);
  }

  private async iniciarExecucao(
    ordemServicoId: string,
    expectedStatuses: OSStatus[]
  ): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);
    if (!expectedStatuses.includes(os.status)) {
      this.logger.warn(
        `[P-08] OS ${ordemServicoId} em status inválido para iniciar execução: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(ordemServicoId, { status: 'IN_PROGRESS' });
    await this.emissor.emitir(new StatusAtualizadoEmExecucao(ordemServicoId));
  }
}
