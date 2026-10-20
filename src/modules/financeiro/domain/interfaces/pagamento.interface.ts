import type { DomainEvent } from '../../../../shared/domain/events/domain-event.base';
import { Pagamento } from '../entities/pagamento.entity';

export interface IPagamentoRepository {
  save(pagamento: Pagamento): Promise<void>;
  findById(id: string): Promise<Pagamento | null>;
  findCobrancaByOrdemServicoId(ordemServicoId: string): Promise<Pagamento | null>;
}

export interface IPagamentoEventPublisher {
  emitir(evento: DomainEvent): Promise<void>;
}

export interface CobrancaCriada {
  preferenceId: string;
  linkPagamento: string;
}

export interface IGatewayPagamento {
  criarCobranca(ordemServicoId: string, valor: number): Promise<CobrancaCriada>;
}

export const PAGAMENTO_REPOSITORY = Symbol('PAGAMENTO_REPOSITORY');
export const GATEWAY_PAGAMENTO = Symbol('GATEWAY_PAGAMENTO');
