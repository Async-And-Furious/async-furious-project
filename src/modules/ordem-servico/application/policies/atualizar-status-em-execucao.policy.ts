import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OsSemPecasConfirmada } from '../../domain/events/os-sem-pecas-confirmada.event';
import { StatusAtualizadoEmExecucao } from '../../domain/events/status-atualizado-em-execucao.event';

@Injectable()
export class AtualizarStatusEmExecucaoPolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos,
  ) {}

  @OnEvent('OsSemPecasConfirmada')
  async handleSemPecas(evento: OsSemPecasConfirmada): Promise<void> {
    await this.iniciarExecucao(evento.ordemServicoId);
  }

  // P-18 hook: when pecas-insumos module emits PecasReservadas, also starts execution
  @OnEvent('PecasReservadas')
  async handlePecasReservadas(evento: { ordemServicoId: string }): Promise<void> {
    await this.iniciarExecucao(evento.ordemServicoId);
  }

  private async iniciarExecucao(ordemServicoId: string): Promise<void> {
    await this.ordemServicoRepository.update(ordemServicoId, { status: 'IN_PROGRESS' });
    await this.emissor.emitir(new StatusAtualizadoEmExecucao(ordemServicoId));
  }
}
