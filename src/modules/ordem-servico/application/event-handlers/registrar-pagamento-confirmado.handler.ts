import { Injectable, Logger } from '@nestjs/common';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import type { PagamentoConfirmado } from '../../domain/events/pagamento-confirmado.event';

export const MOTIVO_PAGAMENTO_CONFIRMADO = 'Pagamento confirmado';

// Antes do orçamento não há pagamento possível: o OrcamentoGerado ainda não foi consumido.
const ANTES_DO_ORCAMENTO: OSStatus[] = ['RECEIVED', 'UNDER_DIAGNOSIS'];

/**
 * PagamentoConfirmado do Billing só grava `pago_em` e uma linha de histórico, sem mudar o status
 * (`event-catalog.md`). O detector de OS parada usa `pago_em` nulo para achar quem não pagou.
 *
 * A gravação é condicionada a `pago_em` nulo: a reentrega não sobrescreve a data nem duplica a
 * linha. Com a OS já em reparo (ExecucaoIniciada chegou antes, por outro tópico), o pagamento
 * ainda é registrado. Com a OS encerrada sem execução, ack. Se o consumo esgotar o retry, a
 * mensagem fica na DLT sem gerar EtapaDaSagaFalhou (o pagamento é válido).
 */
@Injectable()
export class RegistrarPagamentoConfirmadoHandler {
  private readonly logger = new Logger(RegistrarPagamentoConfirmadoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly agora: () => Date = () => new Date()
  ) {}

  async handle(evento: PagamentoConfirmado): Promise<void> {
    const ordemServicoId = evento.ordemServicoId;
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (ANTES_DO_ORCAMENTO.includes(os.status)) {
      throw new FalhaRetentavelException(
        `PagamentoConfirmado antes do orçamento: OS ${ordemServicoId} em ${os.status}`
      );
    }

    if (os.status === 'CLOSED_WITHOUT_EXECUTION') {
      this.logger.log(`PagamentoConfirmado ignorado: OS ${ordemServicoId} já encerrada`);
      return;
    }

    const registrou = await this.ordemServicoRepository.atualizarSeCondicao(
      ordemServicoId,
      { pago_em: null },
      { pago_em: this.agora() }
    );
    if (!registrou) {
      this.logger.log(
        `PagamentoConfirmado já registrado: OS ${ordemServicoId}, reentrega ignorada`
      );
      return;
    }

    await this.statusHistoryRepository.create(
      HistoricoStatus.create({
        ordemServicoId,
        statusAnterior: os.status,
        statusNovo: os.status,
        motivo: `${MOTIVO_PAGAMENTO_CONFIRMADO} (pagamento ${evento.pagamentoId})`,
      })
    );
  }
}
