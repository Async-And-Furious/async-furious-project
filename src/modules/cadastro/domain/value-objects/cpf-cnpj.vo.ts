import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { cpf, cnpj } from 'cpf-cnpj-validator';

export type TipoDocumento = 'CPF' | 'CNPJ';

export class CpfCnpjVo {
  private readonly _valor: string;
  private readonly _tipo: TipoDocumento;

  private constructor(valor: string, tipo: TipoDocumento) {
    this._valor = valor;
    this._tipo = tipo;
  }

  get valor(): string {
    return this._valor;
  }

  get tipo(): TipoDocumento {
    return this._tipo;
  }

  get formato(): string {
    if (this._tipo === 'CPF') {
      return this.formatarCPF(this._valor);
    }
    return this.formatarCNPJ(this._valor);
  }

  private formatarCPF(valor: string): string {
    const nums = valor.replace(/\D/g, '');
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9, 11)}`;
  }

  private formatarCNPJ(valor: string): string {
    const nums = valor.replace(/\D/g, '');
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12, 14)}`;
  }

  static criar(valor: string, tipo: TipoDocumento): CpfCnpjVo {
    if (!valor || (tipo !== 'CPF' && tipo !== 'CNPJ')) {
      throw new DomainException('Tipo de documento invalido');
    }

    const numeros = valor.replace(/\D/g, '');

    if (tipo === 'CPF' && !cpf.isValid(numeros)) {
      throw new DomainException('CPF invalido');
    }
    if (tipo === 'CNPJ' && !cnpj.isValid(numeros)) {
      throw new DomainException('CNPJ invalido');
    }

    return new CpfCnpjVo(numeros, tipo);
  }

  equals(other: CpfCnpjVo): boolean {
    return this._valor === other._valor && this._tipo === other._tipo;
  }
}
