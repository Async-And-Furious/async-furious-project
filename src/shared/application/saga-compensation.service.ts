import {
  EtapaDaSagaFalhou,
  SagaCompleted,
  SagaEtapa,
} from '../domain/events/saga-compensation.events';
import type { IEmissorEventos } from '../domain/interfaces/emissor-eventos.interface';
import type { IReservaEstoqueRepository } from '../../modules/pecas-insumos/domain/interfaces/reserva-estoque.repository.interface';
import type { IPagamentoRepository } from '../../modules/financeiro/domain/interfaces/pagamento.interface';
import type { IRefundGateway } from '../../modules/financeiro/application/ports/refund.gateway';
import type { ISagaCompensationPort } from '../../modules/ordem-servico/application/ports/saga-compensation.port';
import type { ISagaCompensationStore } from './saga-compensation.store';

export class SagaCompensationService {
  private readonly legacyProcessed = new Set<string>();

  constructor(
    private readonly os: ISagaCompensationPort,
    private readonly reservas: IReservaEstoqueRepository,
    private readonly pagamentos: IPagamentoRepository,
    private readonly refund: IRefundGateway,
    private readonly emissor: IEmissorEventos,
    private readonly store?: ISagaCompensationStore
  ) {}

  async compensate(event: EtapaDaSagaFalhou): Promise<void> {
    if (
      this.store
        ? !(await this.store.claimEvent(event.eventId, event.ordemServicoId))
        : this.legacyProcessed.has(event.eventId)
    )
      return;
    if (event.etapa === 'reparo') {
      if (this.store)
        await this.store.recordEvidence(event.eventId, `reparo-falhou:${event.motivo}`);
      else this.legacyProcessed.add(event.eventId);
      await this.emitCompletion(event, []);
      return;
    }

    const compensacoes: string[] = [];
    if (event.etapa === 'aprovacao-pagamento' || event.etapa === 'inicio-execucao') {
      const liberadas = await this.reservas.releaseByOrdemId(event.ordemServicoId);
      if (liberadas > 0) compensacoes.push('reserva-liberada');
    }
    await this.os.closeWithoutExecution(event.ordemServicoId, event.motivo);
    compensacoes.push('os-fechada');

    const pagamento = await this.pagamentos.findByOrdemServicoId(event.ordemServicoId);
    if (pagamento && event.etapa === 'inicio-execucao' && pagamento.getStatus() === 'PAGO') {
      const claim = this.store
        ? await this.store.claimRefund(pagamento.getId(), pagamento.getValor())
        : null;
      if (this.store && claim) {
        await this.refund.refund(pagamento.getId(), pagamento.getValor(), claim.idempotencyKey);
        await this.store.completeRefund(pagamento.getId(), claim.fencingToken);
      } else if (!this.store) {
        await this.refund.refund(
          pagamento.getId(),
          pagamento.getValor(),
          `refund:${pagamento.getId()}`
        );
      } else if (!(await this.store.refundCompleted(pagamento.getId()))) {
        throw new Error(`Refund is leased by another compensation worker: ${pagamento.getId()}`);
      }
      pagamento.estornar();
      await this.pagamentos.save(pagamento);
      compensacoes.push('pagamento-estornado');
    } else if (pagamento && pagamento.getStatus() === 'AGUARDANDO_PAGAMENTO') {
      pagamento.cancelar();
      await this.pagamentos.save(pagamento);
      compensacoes.push('pagamento-cancelado');
    }
    await this.emitCompletion(event, compensacoes);
    if (!this.store) this.legacyProcessed.add(event.eventId);
  }

  async compensateRefusal(
    ordemServicoId: string,
    refusal: 'OrcamentoRecusado' | 'PagamentoRecusado',
    eventId = `${refusal}:${ordemServicoId}`
  ): Promise<void> {
    if (this.store && !(await this.store.claimEvent(eventId, ordemServicoId))) return;
    const compensacoes: string[] = [];
    if (refusal === 'PagamentoRecusado') {
      if ((await this.reservas.releaseByOrdemId(ordemServicoId)) > 0) {
        compensacoes.push('reserva-liberada');
      }
    }
    await this.os.closeWithoutExecution(ordemServicoId, refusal);
    compensacoes.push('os-fechada');
    const pagamento = await this.pagamentos.findByOrdemServicoId(ordemServicoId);
    if (pagamento?.getStatus() === 'AGUARDANDO_PAGAMENTO') {
      pagamento.cancelar();
      await this.pagamentos.save(pagamento);
      compensacoes.push('pagamento-cancelado');
    }
    const completed = this.store
      ? await this.store.completeSaga(ordemServicoId, eventId, compensacoes)
      : !this.legacyProcessed.has(eventId);
    if (completed) {
      try {
        await this.emissor.emitir(new SagaCompleted(ordemServicoId, compensacoes, eventId));
        if (this.store) await this.store.markSagaPublished(eventId);
      } catch (error) {
        if (this.store) {
          await this.store.markSagaPublicationFailed(
            eventId,
            error instanceof Error ? error.message : String(error)
          );
        }
        throw error;
      }
    }
    if (!this.store) this.legacyProcessed.add(eventId);
  }

  private async emitCompletion(event: EtapaDaSagaFalhou, compensacoes: string[]): Promise<void> {
    const completed = this.store
      ? await this.store.completeSaga(event.ordemServicoId, event.eventId, compensacoes)
      : true;
    if (completed) {
      try {
        await this.emissor.emitir(
          new SagaCompleted(event.ordemServicoId, compensacoes, event.eventId)
        );
        if (this.store) await this.store.markSagaPublished(event.eventId);
      } catch (error) {
        if (this.store) {
          await this.store.markSagaPublicationFailed(
            event.eventId,
            error instanceof Error ? error.message : String(error)
          );
        }
        throw error;
      }
    }
  }
}
