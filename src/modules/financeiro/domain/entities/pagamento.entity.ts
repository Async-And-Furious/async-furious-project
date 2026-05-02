import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

export class Pagamento {
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
    novoPagamento.status = 'AGUARDANDO_PAGAMENTO';
    return novoPagamento;
  }

  // P-26: Comportamento de Negócio (Apenas altera o estado interno)
  registrar() {
    this.status = 'PAGO';
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
