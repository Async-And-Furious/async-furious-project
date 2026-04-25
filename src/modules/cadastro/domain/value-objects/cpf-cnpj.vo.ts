import { cpf, cnpj } from 'cpf-cnpj-validator';

export class CpfCnpjVo {
  private static onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  static validateCPF(value: string): boolean {
    return cpf.isValid(this.onlyDigits(value));
  }

  static validateCNPJ(value: string): boolean {
    return cnpj.isValid(this.onlyDigits(value));
  }

  static formatCPF(value: string): string {
    const digits = this.onlyDigits(value);
    if (!this.validateCPF(digits)) {
      throw new Error('Invalid CPF');
    }
    return cpf.format(digits);
  }

  static formatCNPJ(value: string): string {
    const digits = this.onlyDigits(value);
    if (!this.validateCNPJ(digits)) {
      throw new Error('Invalid CNPJ');
    }
    return cnpj.format(digits);
  }

  static formatByType(value: string, tipo: 'CPF' | 'CNPJ'): string {
    return tipo === 'CPF' ? this.formatCPF(value) : this.formatCNPJ(value);
  }
}
