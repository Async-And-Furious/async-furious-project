import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { OrcamentoAprovado } from '../../domain/events/orcamento-aprovado.event';
import { OsSemPecasConfirmada } from '../../domain/events/os-sem-pecas-confirmada.event';
import { OrcamentoAprovadoComPecas } from '../../domain/events/orcamento-aprovado-com-pecas.event';

export const MOTIVO_ORCAMENTO_APROVADO = 'Orçamento aprovado, aguardando pagamento';

// Estados anteriores ao orçamento: o OrcamentoGerado ainda não foi consumido. Falha retentável.
const ANTES_DO_ORCAMENTO: OSStatus[] = ['RECEIVED', 'UNDER_DIAGNOSIS'];

/**
 * OrcamentoAprovado reserva as peças e registra a aprovação no histórico; a OS segue em
 * AWAITING_APPROVAL até ExecucaoIniciada (`event-catalog.md`). Com a OS já encerrada
 * (CLOSED_WITHOUT_EXECUTION), não reserva.
 *
 * Idempotente pela linha de histórico, como a falha de reparo: a reserva debita estoque e não
 * pode acontecer duas vezes. A linha é gravada antes de pedir a reserva: se a reserva falhar
 * depois, a reentrega não reserva de novo (a perda fica no log; debitar em dobro corromperia o
 * estoque).
 */
@Injectable()
export class VerificarNecessidadePecasHandler {
  private readonly logger = new Logger(VerificarNecessidadePecasHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('OrcamentoAprovado')
  async handle(evento: OrcamentoAprovado): Promise<void> {
    const ordemServicoId = evento.ordemServicoId;
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (ANTES_DO_ORCAMENTO.includes(os.status)) {
      throw new FalhaRetentavelException(
        `[P-07] OrcamentoAprovado antes do orçamento: OS ${ordemServicoId} em ${os.status}, esperado AWAITING_APPROVAL`
      );
    }

    if (os.status === 'CLOSED_WITHOUT_EXECUTION') {
      this.logger.log(`[P-07] OrcamentoAprovado ignorado: OS ${ordemServicoId} já encerrada`);
      return;
    }

    const historico = await this.statusHistoryRepository.findByOrdemServicoId(ordemServicoId);
    if (historico.some((linha) => linha.motivo === MOTIVO_ORCAMENTO_APROVADO)) {
      this.logger.log(
        `[P-07] OrcamentoAprovado já registrado: OS ${ordemServicoId}, reentrega ignorada`
      );
      return;
    }

    await this.statusHistoryRepository.create(
      HistoricoStatus.create({
        ordemServicoId,
        statusAnterior: os.status,
        statusNovo: os.status,
        motivo: MOTIVO_ORCAMENTO_APROVADO,
      })
    );

    if (evento.valorTotalPecas > 0) {
      // Emit event for pecas-insumos module to reserve stock (P-18 listener)
      await this.emissor.emitir(new OrcamentoAprovadoComPecas(ordemServicoId, evento.orcamentoId));
    } else {
      await this.emissor.emitir(new OsSemPecasConfirmada(ordemServicoId));
    }
  }
}
