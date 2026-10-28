import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { ExecucaoConcluida } from '../../domain/events/execucao-concluida.event';
import { EtapaDaSagaFalhou } from '../../domain/events/etapa-da-saga-falhou.event';
import { OrdemServicoFinalizada } from '../../domain/events/ordem-servico-finalizada.event';

// Reentrega de ExecucaoConcluida: a OS já foi finalizada, ack com log informativo.
// Em qualquer outro estado o evento é uma anomalia (ack com warn).
const STATUS_JA_FINALIZADA: OSStatus[] = ['FINISHED', 'DELIVERED'];

@Injectable()
export class AtualizarStatusFinalizadaHandler {
  private readonly logger = new Logger(AtualizarStatusFinalizadaHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('ExecucaoConcluida')
  async handle(evento: ExecucaoConcluida): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (os.status === 'AWAITING_PARTS') {
      await this.registrarFalhaDeReparo(evento.ordemServicoId);
      return;
    }

    if (os.status !== 'IN_PROGRESS') {
      const mensagem = `[P-10] ExecucaoConcluida ignorada: OS ${evento.ordemServicoId} em ${os.status}, esperado IN_PROGRESS`;
      if (STATUS_JA_FINALIZADA.includes(os.status)) this.logger.log(mensagem);
      else this.logger.warn(mensagem);
      return;
    }

    await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'FINISHED' });
    await this.emissor.emitir(new OrdemServicoFinalizada(evento.ordemServicoId));
  }

  // AWAITING_PARTS → FINISHED não é transição válida: erro de negócio, sem retry nem compensação
  // (ADR-0018). Registra o motivo no histórico e sinaliza a falha da etapa `reparo`.
  private async registrarFalhaDeReparo(ordemServicoId: string): Promise<void> {
    const motivo = 'ExecucaoConcluida recebida com a OS aguardando peças (AWAITING_PARTS)';
    this.logger.error(`[P-10] OS ${ordemServicoId}: ${motivo}`);
    await this.statusHistoryRepository.create(
      HistoricoStatus.create({
        ordemServicoId,
        statusAnterior: 'AWAITING_PARTS',
        statusNovo: 'AWAITING_PARTS',
        motivo,
      })
    );
    await this.emissor.emitir(
      new EtapaDaSagaFalhou('os-service', 'ExecucaoConcluida', ordemServicoId, 'reparo', motivo)
    );
  }
}
