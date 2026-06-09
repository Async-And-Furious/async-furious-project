import Decimal from 'decimal.js';

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
    this.valor_total_servicos = new Decimal(valor_total_servicos.toString());
    this.valor_total_pecas = new Decimal(valor_total_pecas.toString());
    this.valor_total_geral = this.valor_total_servicos.plus(this.valor_total_pecas);
    this.aprovado = aprovado;

    this.validar();
  }

  private validar(): void {
    if (this.valor_total_servicos.isNegative() || this.valor_total_pecas.isNegative()) {
      throw new Error('Valores do orçamento não podem ser negativos');
    }
  }

  getValorTotalServicos(): Decimal {
    return this.valor_total_servicos;
  }

  getValorTotalPecas(): Decimal {
    return this.valor_total_pecas;
  }

  getValorTotalGeral(): Decimal {
    return this.valor_total_geral;
  }

  isAprovado(): boolean {
    return this.aprovado;
  }

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

  static create(data: OrcamentoData): OrcamentoVo {
    return new OrcamentoVo(
      data.valor_total_servicos,
      data.valor_total_pecas,
      data.aprovado || false
    );
  }

  static createAprovado(data: OrcamentoData): OrcamentoVo {
    return new OrcamentoVo(data.valor_total_servicos, data.valor_total_pecas, true);
  }

  static createFromItems(
    valores_servicos: (Decimal | number)[],
    valores_pecas: (Decimal | number)[]
  ): OrcamentoVo {
    const total_servicos = valores_servicos.reduce((acc: Decimal, val) => {
      const decimal = Decimal.isDecimal(val) ? val : new Decimal(val.toString());
      return acc.plus(decimal);
    }, new Decimal(0));

    const total_pecas = valores_pecas.reduce((acc: Decimal, val) => {
      const decimal = Decimal.isDecimal(val) ? val : new Decimal(val.toString());
      return acc.plus(decimal);
    }, new Decimal(0));

    return new OrcamentoVo(total_servicos, total_pecas, false);
  }
}
