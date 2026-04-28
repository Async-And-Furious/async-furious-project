import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { ServicoConcluidoPeloMecanico } from '../../domain/events/servico-concluido-pelo-mecanico.event';
import { StatusAtualizadoFinalizada } from '../../domain/events/status-atualizado-finalizada.event';

@Injectable()
export class AtualizarStatusFinalizadaPolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos,
  ) {}

  @OnEvent('ServicoConcluidoPeloMecanico')
  async handle(evento: ServicoConcluidoPeloMecanico): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'FINISHED',
    });
    await this.emissor.emitir(new StatusAtualizadoFinalizada(evento.ordemServicoId));
  }
}
