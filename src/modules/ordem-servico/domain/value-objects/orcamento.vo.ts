import Decimal from 'decimal.js';

export interface OrcamentoData {
  valor_total_servicos: Decimal | number;
  valor_total_pecas: Decimal | number;
}

export class OrcamentoVo {
  private readonly valor_total_servicos: Decimal;
  private readonly valor_total_pecas: Decimal;
  private readonly valor_total_geral: Decimal;

  private constructor(
    valor_total_servicos: Decimal | number,
    valor_total_pecas: Decimal | number
  ) {
    this.valor_total_servicos = new Decimal(valor_total_servicos.toString());
    this.valor_total_pecas = new Decimal(valor_total_pecas.toString());
    this.valor_total_geral = this.valor_total_servicos.plus(this.valor_total_pecas);

    this.validar();
  }

  private validar(): void {
    if (this.valor_total_servicos.isNegative() || this.valor_total_pecas.isNegative()) {
      throw new Error('Valores do orçamento não podem ser negativos');
    }
  }

  getValorTotalServicos(): number {
    return this.valor_total_servicos.toNumber();
  }

  getValorTotalPecas(): number {
    return this.valor_total_pecas.toNumber();
  }

  getValorTotalGeral(): number {
    return this.valor_total_geral.toNumber();
  }

  static create(data: OrcamentoData): OrcamentoVo {
    return new OrcamentoVo(data.valor_total_servicos, data.valor_total_pecas);
  }
}
