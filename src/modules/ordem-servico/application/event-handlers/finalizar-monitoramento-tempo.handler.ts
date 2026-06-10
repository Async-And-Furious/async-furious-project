import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { StatusAtualizadoFinalizada } from '../../domain/events/status-atualizado-finalizada.event';

@Injectable()
export class FinalizarMonitoramentoTempoHandler {
  private readonly logger = new Logger(FinalizarMonitoramentoTempoHandler.name);

  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('StatusAtualizadoFinalizada')
  async handle(evento: StatusAtualizadoFinalizada): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    const finalizada_em = new Date();
    await this.ordemServicoRepository.update(evento.ordemServicoId, { finalizada_em });

    if (os.iniciada_em) {
      const duracaoMs = finalizada_em.getTime() - os.iniciada_em.getTime();
      const duracaoMin = Math.round(duracaoMs / 60000);
      this.logger.log(`OS ${evento.ordemServicoId} finalizada em ${duracaoMin} minuto(s).`);
    }
  }
}
