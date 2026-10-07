import { EtapaDaSagaFalhou, SagaCompleted, SagaEtapa } from '../domain/events/saga-compensation.events';
import type { IEmissorEventos } from '../domain/interfaces/emissor-eventos.interface';
import type { IReservaEstoqueRepository } from '../../modules/pecas-insumos/domain/interfaces/reserva-estoque.repository.interface';
import type { IPagamentoRepository } from '../../modules/financeiro/domain/interfaces/pagamento.interface';
import type { IRefundGateway } from '../../modules/financeiro/application/ports/refund.gateway';
import type { ISagaCompensationPort } from '../../modules/ordem-servico/application/ports/saga-compensation.port';

export class SagaCompensationService {
  private readonly processed = new Set<string>();

  constructor(
    private readonly os: ISagaCompensationPort,
    private readonly reservas: IReservaEstoqueRepository,
    private readonly pagamentos: IPagamentoRepository,
    private readonly refund: IRefundGateway,
    private readonly emissor: IEmissorEventos
  ) {}

  async compensate(event: EtapaDaSagaFalhou): Promise<void> {
    if (this.processed.has(event.eventId)) return;
    if (event.etapa === 'reparo') {
      this.processed.add(event.eventId);
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
      await this.refund.refund(pagamento.getId(), pagamento.getValor());
      pagamento.estornar();
      await this.pagamentos.save(pagamento);
      compensacoes.push('pagamento-estornado');
    } else if (pagamento && pagamento.getStatus() === 'AGUARDANDO_PAGAMENTO') {
      pagamento.cancelar();
      await this.pagamentos.save(pagamento);
      compensacoes.push('pagamento-cancelado');
    }
    await this.emissor.emitir(new SagaCompleted(event.ordemServicoId, compensacoes));
    this.processed.add(event.eventId);
  }

  async compensateRefusal(
    ordemServicoId: string,
    refusal: 'OrcamentoRecusado' | 'PagamentoRecusado'
  ): Promise<void> {
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
    await this.emissor.emitir(new SagaCompleted(ordemServicoId, compensacoes));
  }
}
