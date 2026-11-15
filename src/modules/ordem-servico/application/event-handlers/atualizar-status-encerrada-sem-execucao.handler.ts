import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IReservaEstoquePort } from '../../../../shared/domain/interfaces/reserva-estoque.port';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { OrcamentoRecusado } from '../../domain/events/orcamento-recusado.event';
import type { PagamentoRecusado } from '../../domain/events/pagamento-recusado.event';
import type { EtapaDaSagaFalhou } from '../../domain/events/etapa-da-saga-falhou.event';
import { StatusAtualizadoEncerradaSemExecucao } from '../../domain/events/status-atualizado-encerrada-sem-execucao.event';
import { logOsStatusTransition } from '../logging/log-os-status-transition';
import type { IOSStatusTransitionLogger } from '../logging/log-os-status-transition';

export const MOTIVO_ORCAMENTO_RECUSADO = 'Orçamento recusado pelo cliente';
export const MOTIVO_PAGAMENTO_RECUSADO = 'Pagamento recusado pelo Mercado Pago';

export const motivoEtapaDaSagaFalhou = (evento: EtapaDaSagaFalhou): string =>
  `Falha técnica na etapa ${evento.etapa} (${evento.servicoOrigem}): ${evento.motivo}`;

// Estados de onde a recusa fecha a OS (TRANSICOES_PERMITIDAS → CLOSED_WITHOUT_EXECUTION).
const ANTES_DO_REPARO: OSStatus[] = ['RECEIVED', 'UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'];
// Reparo já começou: a recusa só fica registrada no histórico (`event-catalog.md`).
const EM_REPARO: OSStatus[] = ['IN_PROGRESS', 'AWAITING_PARTS'];

/**
 * Lado do OS na matriz de compensação (`saga-flow.md` §3): recusas de negócio vindas do Billing
 * (OrcamentoRecusado, PagamentoRecusado) e falhas técnicas (`EtapaDaSagaFalhou`, #338). Antes do
 * reparo, fecham a OS como CLOSED_WITHOUT_EXECUTION, com a gravação condicionada ao status lido; se
 * outro evento mudou a OS entre a leitura e a gravação, a falha é retentável e a reentrega decide
 * pelo estado novo. Durante o reparo, só registram o motivo, uma vez. Encerrada, ack.
 *
 * Fechada a OS, devolve ao estoque as peças reservadas na aprovação. A devolução vem depois do
 * fechamento (nunca devolve peças de uma OS que entrou em reparo) e é idempotente; se falhar, a
 * reentrega encontra a OS já em CLOSED_WITHOUT_EXECUTION e tenta devolver de novo.
 *
 * `etapa=reparo` não compensa: o mecânico já começou, então só o motivo fica no histórico.
 */
@Injectable()
export class AtualizarStatusEncerradaSemExecucaoHandler {
  private readonly logger = new Logger(AtualizarStatusEncerradaSemExecucaoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly transicao: StatusTransitionService,
    private readonly transitionLogger: IOSStatusTransitionLogger,
    private readonly reservaEstoque: IReservaEstoquePort
  ) {}

  @OnEvent('OrcamentoRecusado')
  async handle(evento: OrcamentoRecusado): Promise<void> {
    await this.encerrar(evento.ordemServicoId, 'OrcamentoRecusado', MOTIVO_ORCAMENTO_RECUSADO);
  }

  async handlePagamentoRecusado(evento: PagamentoRecusado): Promise<void> {
    await this.encerrar(evento.ordemServicoId, 'PagamentoRecusado', MOTIVO_PAGAMENTO_RECUSADO);
  }

  async handleEtapaDaSagaFalhou(evento: EtapaDaSagaFalhou): Promise<void> {
    const motivo = motivoEtapaDaSagaFalhou(evento);
    if (evento.etapa === 'reparo') {
      const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
      await this.registrarMotivo(evento.ordemServicoId, os.status, motivo);
      this.logger.warn(
        `[P-14] EtapaDaSagaFalhou em reparo: OS ${evento.ordemServicoId} segue em ${os.status}, sem compensação automática`
      );
      return;
    }
    await this.encerrar(evento.ordemServicoId, 'EtapaDaSagaFalhou', motivo);
  }

  private async encerrar(ordemServicoId: string, origem: string, motivo: string): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (ANTES_DO_REPARO.includes(os.status)) {
      this.transicao.validarTransicao(os.status, 'CLOSED_WITHOUT_EXECUTION');
      const encerrou = await this.ordemServicoRepository.atualizarSeCondicao(
        ordemServicoId,
        { status: os.status },
        { status: 'CLOSED_WITHOUT_EXECUTION', motivo }
      );
      if (!encerrou) {
        throw new FalhaRetentavelException(
          `[P-14] ${origem}: OS ${ordemServicoId} saiu de ${os.status} durante a gravação`
        );
      }
      // O repository grava o histórico (com o motivo) na mesma transação.
      logOsStatusTransition(this.transitionLogger, os.status, 'CLOSED_WITHOUT_EXECUTION');
      await this.emissor.emitir(new StatusAtualizadoEncerradaSemExecucao(ordemServicoId));
      await this.liberarReserva(ordemServicoId, origem);
      return;
    }

    if (EM_REPARO.includes(os.status)) {
      await this.registrarMotivo(ordemServicoId, os.status, motivo);
      this.logger.warn(
        `[P-14] ${origem} com o reparo em andamento: OS ${ordemServicoId} segue em ${os.status}`
      );
      return;
    }

    if (os.status === 'CLOSED_WITHOUT_EXECUTION') {
      // Reentrega depois de uma devolução que falhou; sem reserva pendente, não faz nada.
      await this.liberarReserva(ordemServicoId, origem);
    }
    this.logger.log(`[P-14] ${origem} ignorado: OS ${ordemServicoId} já em ${os.status}`);
  }

  private async registrarMotivo(
    ordemServicoId: string,
    status: OSStatus,
    motivo: string
  ): Promise<void> {
    const historico = await this.statusHistoryRepository.findByOrdemServicoId(ordemServicoId);
    if (historico.some((linha) => linha.motivo === motivo)) return;
    await this.statusHistoryRepository.create(
      HistoricoStatus.create({
        ordemServicoId,
        statusAnterior: status,
        statusNovo: status,
        motivo,
      })
    );
  }

  private async liberarReserva(ordemServicoId: string, origem: string): Promise<void> {
    const devolvidas = await this.reservaEstoque.releaseByOrdemId(ordemServicoId);
    if (devolvidas > 0) {
      this.logger.log(
        `[P-14] ${origem}: ${devolvidas} reserva(s) de peças da OS ${ordemServicoId} devolvida(s) ao estoque`
      );
    }
  }
}
