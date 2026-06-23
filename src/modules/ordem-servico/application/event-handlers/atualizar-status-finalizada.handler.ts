import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { ServicoConcluidoPeloMecanico } from '../../domain/events/servico-concluido-pelo-mecanico.event';
import { StatusAtualizadoFinalizada } from '../../domain/events/status-atualizado-finalizada.event';

@Injectable()
export class AtualizarStatusFinalizadaHandler {
  private readonly logger = new Logger(AtualizarStatusFinalizadaHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('ServicoConcluidoPeloMecanico')
  async handle(evento: ServicoConcluidoPeloMecanico): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'IN_PROGRESS') {
      this.logger.warn(
        `[P-10] OS ${evento.ordemServicoId} em status inválido para finalizar: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'FINISHED' });
    await this.emissor.emitir(new StatusAtualizadoFinalizada(evento.ordemServicoId));
  }
}
