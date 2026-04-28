import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrcamentoRecusado } from '../../domain/events/orcamento-recusado.event';
import { StatusAtualizadoEncerradaSemExecucao } from '../../domain/events/status-atualizado-encerrada-sem-execucao.event';

@Injectable()
export class AtualizarStatusEncerradaSemExecucaoPolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos,
  ) {}

  @OnEvent('OrcamentoRecusado')
  async handle(evento: OrcamentoRecusado): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'CLOSED_WITHOUT_EXECUTION',
    });
    await this.emissor.emitir(
      new StatusAtualizadoEncerradaSemExecucao(evento.ordemServicoId),
    );
  }
}
