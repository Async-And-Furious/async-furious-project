import type { DomainEvent } from '../../../../shared/domain/events/domain-event.base';
import { Pagamento } from '../entities/pagamento.entity';

export interface IPagamentoRepository {
  save(pagamento: Pagamento): Promise<void>;
  findById(id: string): Promise<Pagamento | null>;
  findByOrdemServicoId(ordemServicoId: string): Promise<Pagamento | null>;
}

export interface IRefundGateway {
  refund(paymentId: string, amount: number): Promise<void>;
}

export const REFUND_GATEWAY = Symbol('REFUND_GATEWAY');

export interface IPagamentoEventPublisher {
  emitir(evento: DomainEvent): Promise<void>;
}

export const PAGAMENTO_REPOSITORY = Symbol('PAGAMENTO_REPOSITORY');
