export class PecaInsumo {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  preco: number;
  quantidade_estoque: number;
  quantidade_minima: number;
  created_at: Date;
  updated_at: Date;

  /**
   * P-23: Receive stock from supplier
   * @param quantidade Quantity received from supplier order
   * @throws Error if quantity is not positive
   */
  receberDoFornecedor(quantidade: number): void {
    if (quantidade <= 0) {
      throw new Error('Quantidade recebida deve ser positiva');
    }
    this.quantidade_estoque += quantidade;
  }

  /**
   * P-24/P-25: Check if this part can fulfill a required reservation
   * @param quantidadeNecessaria Required quantity
   * @returns true if stock is sufficient
   */
  podeAtenderReserva(quantidadeNecessaria: number): boolean {
    return this.quantidade_estoque >= quantidadeNecessaria;
  }

  /**
   * P-19/P-25: Debit stock for a service order
   * @param quantidade Quantity to debit
   * @throws Error if insufficient stock
   */
  debitarEstoque(quantidade: number): void {
    if (quantidade <= 0) {
      throw new Error('Quantidade deve ser positiva');
    }
    if (this.quantidade_estoque < quantidade) {
      throw new Error(
        `Estoque insuficiente para ${this.nome}: disponível=${this.quantidade_estoque}, solicitado=${quantidade}`
      );
    }
    this.quantidade_estoque -= quantidade;
  }

  /**
   * Check if stock is below minimum threshold
   */
  estaBelowMinimo(): boolean {
    return this.quantidade_estoque < this.quantidade_minima;
  }
}
