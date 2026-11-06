import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { OrcamentoRecusado } from '../../domain/events/orcamento-recusado.event';
import type { PagamentoRecusado } from '../../domain/events/pagamento-recusado.event';
import { StatusAtualizadoEncerradaSemExecucao } from '../../domain/events/status-atualizado-encerrada-sem-execucao.event';
import { logOsStatusTransition } from '../../../../shared/infrastructure/logging/os-status-transition';

export const MOTIVO_ORCAMENTO_RECUSADO = 'Orçamento recusado pelo cliente';
export const MOTIVO_PAGAMENTO_RECUSADO = 'Pagamento recusado pelo Mercado Pago';

// Estados de onde a recusa fecha a OS (TRANSICOES_PERMITIDAS → CLOSED_WITHOUT_EXECUTION).
const ANTES_DO_REPARO: OSStatus[] = ['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'];
// Reparo já começou: a recusa só fica registrada no histórico (`event-catalog.md`).
const EM_REPARO: OSStatus[] = ['IN_PROGRESS', 'AWAITING_PARTS'];

/**
 * Recusas de negócio vindas do Billing (OrcamentoRecusado, PagamentoRecusado). Antes do reparo,
 * fecham a OS como CLOSED_WITHOUT_EXECUTION, com a gravação condicionada ao status lido; se outro
 * evento mudou a OS entre a leitura e a gravação, a falha é retentável e a reentrega decide pelo
 * estado novo. Durante o reparo, só registram o motivo, uma vez. Encerrada, ack.
 *
 * A devolução ao estoque das peças reservadas na aprovação é compensação (#338), fora daqui.
 */
@Injectable()
export class AtualizarStatusEncerradaSemExecucaoHandler {
  private readonly logger = new Logger(AtualizarStatusEncerradaSemExecucaoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('OrcamentoRecusado')
  async handle(evento: OrcamentoRecusado): Promise<void> {
    await this.encerrar(evento.ordemServicoId, 'OrcamentoRecusado', MOTIVO_ORCAMENTO_RECUSADO);
  }

  async handlePagamentoRecusado(evento: PagamentoRecusado): Promise<void> {
    await this.encerrar(evento.ordemServicoId, 'PagamentoRecusado', MOTIVO_PAGAMENTO_RECUSADO);
  }

  private async encerrar(ordemServicoId: string, origem: string, motivo: string): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (ANTES_DO_REPARO.includes(os.status)) {
      this.transicao.validarTransicao(os.status, 'CLOSED_WITHOUT_EXECUTION');
      const encerrou = await this.ordemServicoRepository.atualizarSeCondicao(
        ordemServicoId,
        { status: os.status },
        { status: 'CLOSED_WITHOUT_EXECUTION' }
      );
      if (!encerrou) {
        throw new FalhaRetentavelException(
          `[P-14] ${origem}: OS ${ordemServicoId} saiu de ${os.status} durante a gravação`
        );
      }
      logOsStatusTransition(this.logger, os.status, 'CLOSED_WITHOUT_EXECUTION');
      await this.statusHistoryRepository.create(
        HistoricoStatus.create({
          ordemServicoId,
          statusAnterior: os.status,
          statusNovo: 'CLOSED_WITHOUT_EXECUTION',
          motivo,
        })
      );
      await this.emissor.emitir(new StatusAtualizadoEncerradaSemExecucao(ordemServicoId));
      return;
    }

    if (EM_REPARO.includes(os.status)) {
      const historico = await this.statusHistoryRepository.findByOrdemServicoId(ordemServicoId);
      if (!historico.some((linha) => linha.motivo === motivo)) {
        await this.statusHistoryRepository.create(
          HistoricoStatus.create({
            ordemServicoId,
            statusAnterior: os.status,
            statusNovo: os.status,
            motivo,
          })
        );
      }
      this.logger.warn(
        `[P-14] ${origem} com o reparo em andamento: OS ${ordemServicoId} segue em ${os.status}`
      );
      return;
    }

    this.logger.log(`[P-14] ${origem} ignorado: OS ${ordemServicoId} já em ${os.status}`);
  }
}
