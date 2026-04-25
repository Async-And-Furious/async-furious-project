import { Decimal } from '@prisma/client/runtime/library';

export interface OrcamentoData {
  valor_total_servicos: Decimal | number;
  valor_total_pecas: Decimal | number;
  aprovado?: boolean;
}

export class OrcamentoVo {
  private readonly valor_total_servicos: Decimal;
  private readonly valor_total_pecas: Decimal;
  private readonly valor_total_geral: Decimal;
  private readonly aprovado: boolean;

  private constructor(
    valor_total_servicos: Decimal | number,
    valor_total_pecas: Decimal | number,
    aprovado: boolean = false
  ) {
    this.valor_total_servicos = this.toDecimal(valor_total_servicos);
    this.valor_total_pecas = this.toDecimal(valor_total_pecas);
    this.valor_total_geral = this.calcularTotalGeral(
      this.valor_total_servicos,
      this.valor_total_pecas
    );
    this.aprovado = aprovado;

    this.validar();
  }

  /**
   * Validações do Orçamento
   * - Valores não podem ser negativos
   * - Valores devem ser maiores ou iguais a zero
   */
  private validar(): void {
    if (this.valor_total_servicos.isNegative() || this.valor_total_pecas.isNegative()) {
      throw new Error('Valores do orçamento não podem ser negativos');
    }
  }

  /**
   * Converte número ou Decimal para Decimal do Prisma
   */
  private toDecimal(value: Decimal | number): Decimal {
    if (value instanceof Decimal) {
      return value;
    }
    return new Decimal(value);
  }

  /**
   * Calcula o total geral (serviços + peças)
   */
  private calcularTotalGeral(servicos: Decimal, pecas: Decimal): Decimal {
    return servicos.plus(pecas);
  }

  /**
   * Retorna o valor total dos serviços
   */
  getValorTotalServicos(): Decimal {
    return this.valor_total_servicos;
  }

  /**
   * Retorna o valor total das peças
   */
  getValorTotalPecas(): Decimal {
    return this.valor_total_pecas;
  }

  /**
   * Retorna o valor total geral (serviços + peças)
   */
  getValorTotalGeral(): Decimal {
    return this.valor_total_geral;
  }

  /**
   * Verifica se o orçamento foi aprovado
   */
  isAprovado(): boolean {
    return this.aprovado;
  }

  /**
   * Retorna o objeto como DTO para resposta da API
   */
  toDTO(): {
    valor_total_servicos: string;
    valor_total_pecas: string;
    valor_total_geral: string;
    aprovado: boolean;
  } {
    return {
      valor_total_servicos: this.valor_total_servicos.toString(),
      valor_total_pecas: this.valor_total_pecas.toString(),
      valor_total_geral: this.valor_total_geral.toString(),
      aprovado: this.aprovado,
    };
  }

  /**
   * Factory method para criar um novo Orçamento
   * @param data Dados do orçamento
   * @returns Uma nova instância de OrcamentoVo
   */
  static create(data: OrcamentoData): OrcamentoVo {
    return new OrcamentoVo(
      data.valor_total_servicos,
      data.valor_total_pecas,
      data.aprovado || false
    );
  }

  /**
   * Factory method para criar um novo Orçamento aprovado
   * @param data Dados do orçamento
   * @returns Uma nova instância de OrcamentoVo com aprovado = true
   */
  static createAprovado(data: OrcamentoData): OrcamentoVo {
    return new OrcamentoVo(data.valor_total_servicos, data.valor_total_pecas, true);
  }

  /**
   * Factory method para criar um orçamento com base em arrays de valores
   * Útil quando temos ItemServico[] e ItemPeca[]
   * @param valores_servicos Array com valores dos serviços
   * @param valores_pecas Array com valores das peças
   * @returns Uma nova instância de OrcamentoVo
   */
  static createFromItems(
    valores_servicos: (Decimal | number)[],
    valores_pecas: (Decimal | number)[]
  ): OrcamentoVo {
    const total_servicos = valores_servicos.reduce((acc, val) => {
      const decimal = val instanceof Decimal ? val : new Decimal(val);
      return acc.plus(decimal);
    }, new Decimal(0));

    const total_pecas = valores_pecas.reduce((acc, val) => {
      const decimal = val instanceof Decimal ? val : new Decimal(val);
      return acc.plus(decimal);
    }, new Decimal(0));

    return new OrcamentoVo(total_servicos, total_pecas, false);
  }
}
