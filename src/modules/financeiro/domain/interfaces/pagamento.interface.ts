import type { DomainEvent } from '../../../../shared/domain/events/domain-event.base';
import { Pagamento } from '../entities/pagamento.entity';

export interface NotificacaoRecebida {
  providerEventId: string;
  tipo: string;
}

export interface IPagamentoRepository {
  save(pagamento: Pagamento): Promise<void>;
  findById(id: string): Promise<Pagamento | null>;
  findByOrdemServicoId(ordemServicoId: string): Promise<Pagamento | null>;
  // Insere um pagamento novo; false se a OS já tem pagamento (constraint única em ordemServicoId).
  reservar(pagamento: Pagamento): Promise<boolean>;
  remover(id: string): Promise<void>;
  // Atualiza o pagamento e grava a notificação na mesma transação; false se a notificação já foi processada.
  saveComNotificacao(pagamento: Pagamento, notificacao: NotificacaoRecebida): Promise<boolean>;
}

export interface IPagamentoEventPublisher {
  emitir(evento: DomainEvent): Promise<void>;
}

export interface CobrancaCriada {
  preferenceId: string;
  linkPagamento: string;
}

export interface PagamentoExterno {
  id: string;
  status: string;
  referenciaExterna: string | null;
  valor: number | null;
}

export interface IGatewayPagamento {
  criarCobranca(ordemServicoId: string, valor: number): Promise<CobrancaCriada>;
  // null quando o pagamento não existe no provedor (ex.: notificação de teste do painel).
  consultarPagamento(id: string): Promise<PagamentoExterno | null>;
}

export const PAGAMENTO_REPOSITORY = Symbol('PAGAMENTO_REPOSITORY');
export const GATEWAY_PAGAMENTO = Symbol('GATEWAY_PAGAMENTO');
