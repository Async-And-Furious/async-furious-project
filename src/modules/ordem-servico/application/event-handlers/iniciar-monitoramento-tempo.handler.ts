import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { StatusAtualizadoEmExecucao } from '../../domain/events/status-atualizado-em-execucao.event';

@Injectable()
export class IniciarMonitoramentoTempoHandler {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('StatusAtualizadoEmExecucao')
  async handle(evento: StatusAtualizadoEmExecucao): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      iniciada_em: new Date(),
    });
  }
}
