import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

// Status vindos do Mercado Pago: AGUARDANDO_PAGAMENTO → CONFIRMADO | RECUSADO (terminais).
// Registros antigos podem ter PAGO (fluxo da Fase 3, antes do Mercado Pago).
export class Pagamento {
  private id!: string;
  private status!: string;
  private ordemServicoId: string;
  private valor: number;
  private preferenceId: string | null = null;
  private linkPagamento: string | null = null;
  private pagamentoExternoId: string | null = null;

  private constructor(ordemServicoId: string, valor: number) {
    this.ordemServicoId = ordemServicoId;
    this.valor = valor;
  }

  static criar(ordemServicoId: string, valor: number): Pagamento {
    if (valor <= 0) {
      throw new DomainException('Valor do pagamento deve ser positivo.');
    }

    const novoPagamento = new Pagamento(ordemServicoId, valor);
    novoPagamento.id = crypto.randomUUID();
    novoPagamento.status = 'AGUARDANDO_PAGAMENTO';
    return novoPagamento;
  }

  static reconstituir(props: {
    id: string;
    ordemServicoId: string;
    valor: number;
    status: string;
    preferenceId?: string | null;
    linkPagamento?: string | null;
    pagamentoExternoId?: string | null;
  }): Pagamento {
    const pagamento = new Pagamento(props.ordemServicoId, props.valor);
    pagamento.id = props.id;
    pagamento.status = props.status;
    pagamento.preferenceId = props.preferenceId ?? null;
    pagamento.linkPagamento = props.linkPagamento ?? null;
    pagamento.pagamentoExternoId = props.pagamentoExternoId ?? null;
    return pagamento;
  }

  estaPendente(): boolean {
    return this.status === 'AGUARDANDO_PAGAMENTO';
  }

  // Pagamento aprovado no Mercado Pago, confirmado pela reconsulta do webhook.
  confirmar(pagamentoExternoId: string) {
    this.exigirPendente('confirmar');
    this.status = 'CONFIRMADO';
    this.pagamentoExternoId = pagamentoExternoId;
  }

  // Terminal por simplificação da saga (ADR-0022): uma tentativa recusada encerra a cobrança.
  recusar(pagamentoExternoId: string) {
    this.exigirPendente('recusar');
    this.status = 'RECUSADO';
    this.pagamentoExternoId = pagamentoExternoId;
  }

  vincularCobranca(preferenceId: string, linkPagamento: string) {
    this.exigirPendente('vincular cobrança a');
    this.preferenceId = preferenceId;
    this.linkPagamento = linkPagamento;
  }

  private exigirPendente(acao: string) {
    if (!this.estaPendente()) {
      throw new DomainException(`Só é possível ${acao} um pagamento pendente.`);
    }
  }

  getId() {
    return this.id;
  }
  getStatus() {
    return this.status;
  }
  getOrdemServicoId() {
    return this.ordemServicoId;
  }
  getValor() {
    return this.valor;
  }
  getPreferenceId() {
    return this.preferenceId;
  }
  getLinkPagamento() {
    return this.linkPagamento;
  }
  getPagamentoExternoId() {
    return this.pagamentoExternoId;
  }
}
