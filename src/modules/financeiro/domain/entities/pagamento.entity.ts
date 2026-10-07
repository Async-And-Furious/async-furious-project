import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

export class Pagamento {
  static readonly STATUS_AGUARDANDO = 'AGUARDANDO_PAGAMENTO';
  static readonly STATUS_CONFIRMADO = 'PAGO';
  static readonly STATUS_CANCELADO = 'CANCELADO';
  static readonly STATUS_ESTORNADO = 'ESTORNADO';
  private id!: string;
  private status!: string;
  private ordemServicoId: string;
  private valor: number;

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
    novoPagamento.status = Pagamento.STATUS_AGUARDANDO;
    return novoPagamento;
  }

  static reconstituir(props: {
    id: string;
    ordemServicoId: string;
    valor: number;
    status: string;
  }): Pagamento {
    const pagamento = new Pagamento(props.ordemServicoId, props.valor);
    pagamento.id = props.id;
    pagamento.status = props.status;
    return pagamento;
  }

  // P-26: Comportamento de Negócio (Apenas altera o estado interno)
  registrar() {
    if (this.status === Pagamento.STATUS_CONFIRMADO) return;
    if (this.status !== Pagamento.STATUS_AGUARDANDO) {
      throw new DomainException('Pagamento não pode ser confirmado neste estado.');
    }
    this.status = Pagamento.STATUS_CONFIRMADO;
  }

  cancelar(): void {
    if (this.status === Pagamento.STATUS_CANCELADO) return;
    if (this.status === Pagamento.STATUS_ESTORNADO || this.status === Pagamento.STATUS_CONFIRMADO) {
      throw new DomainException('Pagamento capturado não pode ser cancelado.');
    }
    this.status = Pagamento.STATUS_CANCELADO;
  }

  estornar(): void {
    if (this.status === Pagamento.STATUS_ESTORNADO) return;
    if (this.status !== Pagamento.STATUS_CONFIRMADO) {
      throw new DomainException('Somente pagamento confirmado pode ser estornado.');
    }
    this.status = Pagamento.STATUS_ESTORNADO;
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
}
