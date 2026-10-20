import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

export class Pagamento {
  private id!: string;
  private status!: string;
  private ordemServicoId: string;
  private valor: number;
  private preferenceId: string | null = null;
  private linkPagamento: string | null = null;

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
  }): Pagamento {
    const pagamento = new Pagamento(props.ordemServicoId, props.valor);
    pagamento.id = props.id;
    pagamento.status = props.status;
    pagamento.preferenceId = props.preferenceId ?? null;
    pagamento.linkPagamento = props.linkPagamento ?? null;
    return pagamento;
  }

  // P-26: Comportamento de Negócio (Apenas altera o estado interno)
  registrar() {
    this.status = 'PAGO';
  }

  // Pagamento aprovado no Mercado Pago (Checkout Pro), confirmado pela reconsulta do webhook.
  confirmar() {
    if (this.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new DomainException('Só é possível confirmar um pagamento pendente.');
    }
    this.status = 'CONFIRMADO';
  }

  vincularCobranca(preferenceId: string, linkPagamento: string) {
    if (this.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new DomainException('Só é possível vincular cobrança a um pagamento pendente.');
    }
    this.preferenceId = preferenceId;
    this.linkPagamento = linkPagamento;
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
}
