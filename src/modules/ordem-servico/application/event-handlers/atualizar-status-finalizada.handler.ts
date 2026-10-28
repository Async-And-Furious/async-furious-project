import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { ExecucaoConcluida } from '../../domain/events/execucao-concluida.event';
import { EtapaDaSagaFalhou } from '../../domain/events/etapa-da-saga-falhou.event';
import { OrdemServicoFinalizada } from '../../domain/events/ordem-servico-finalizada.event';

// Estados anteriores ao reparo: o evento chegou antes da hora. Falha retentável (ADR-0018).
const ANTES_DO_REPARO: OSStatus[] = ['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'];

const MOTIVO_REPARO_COM_PECAS_PENDENTES =
  'ExecucaoConcluida recebida com a OS aguardando peças (AWAITING_PARTS)';

@Injectable()
export class AtualizarStatusFinalizadaHandler {
  private readonly logger = new Logger(AtualizarStatusFinalizadaHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly emissor: IEmissorEventos,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('ExecucaoConcluida')
  async handle(evento: ExecucaoConcluida): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (os.status === 'AWAITING_PARTS') {
      await this.registrarFalhaDeReparo(evento.ordemServicoId);
      return;
    }

    if (ANTES_DO_REPARO.includes(os.status)) {
      throw new FalhaRetentavelException(
        `[P-10] ExecucaoConcluida antes do reparo: OS ${evento.ordemServicoId} em ${os.status}, esperado IN_PROGRESS`
      );
    }

    if (os.status !== 'IN_PROGRESS') {
      this.logger.log(
        `[P-10] ExecucaoConcluida ignorada: OS ${evento.ordemServicoId} em ${os.status}, esperado IN_PROGRESS`
      );
      return;
    }

    this.transicao.validarTransicao('IN_PROGRESS', 'FINISHED');
    await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'FINISHED' });
    await this.emissor.emitir(new OrdemServicoFinalizada(evento.ordemServicoId));
  }

  // AWAITING_PARTS → FINISHED não é transição válida: erro de negócio, sem retry (ADR-0018).
  // Sinaliza a falha da etapa `reparo` e registra o motivo no histórico. Idempotente na
  // reentrega: se a linha de histórico já existe, a falha já foi sinalizada e só se registra o log.
  // O evento sai antes da linha de histórico: se a gravação falhar, a reentrega emite de novo
  // (at-least-once; a compensação é idempotente, ADR-0018), em vez de perder a sinalização.
  private async registrarFalhaDeReparo(ordemServicoId: string): Promise<void> {
    const historico = await this.statusHistoryRepository.findByOrdemServicoId(ordemServicoId);
    if (historico.some((linha) => linha.motivo === MOTIVO_REPARO_COM_PECAS_PENDENTES)) {
      this.logger.log(
        `[P-10] OS ${ordemServicoId}: falha de reparo já registrada, reentrega ignorada`
      );
      return;
    }

    this.logger.error(`[P-10] OS ${ordemServicoId}: ${MOTIVO_REPARO_COM_PECAS_PENDENTES}`);
    await this.emissor.emitir(
      new EtapaDaSagaFalhou(
        'os-service',
        'ExecucaoConcluida',
        ordemServicoId,
        'reparo',
        MOTIVO_REPARO_COM_PECAS_PENDENTES
      )
    );
    await this.statusHistoryRepository.create(
      HistoricoStatus.create({
        ordemServicoId,
        statusAnterior: 'AWAITING_PARTS',
        statusNovo: 'AWAITING_PARTS',
        motivo: MOTIVO_REPARO_COM_PECAS_PENDENTES,
      })
    );
  }
}
