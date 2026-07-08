import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrdemServicoEmExecucao } from '../../domain/events/ordem-servico-em-execucao.event';

@Injectable()
export class IniciarMonitoramentoTempoHandler {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('OrdemServicoEmExecucao')
  async handle(evento: OrdemServicoEmExecucao): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      iniciada_em: new Date(),
    });
  }
}
