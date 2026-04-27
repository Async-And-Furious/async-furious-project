import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

const BRAZILIAN_PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export class PlacaVeiculoVo {
  private readonly _valor: string;

  private constructor(valor: string) {
    this._valor = valor;
  }

  get valor(): string {
    return this._valor;
  }

  get formato(): string {
    return this._valor.toUpperCase();
  }

  static isValid(placa: string): boolean {
    if (!placa || typeof placa !== 'string') return false;
    const sanitized = placa.replace(/[-\s]/g, '').toUpperCase();
    if (sanitized.length !== 7) return false;
    return BRAZILIAN_PLATE_PATTERN.test(sanitized);
  }

  static criar(placa: string): PlacaVeiculoVo {
    if (!placa || typeof placa !== 'string') {
      throw new DomainException('Placa inválida');
    }

    const sanitized = placa.replace(/[-\s]/g, '').toUpperCase();

    if (sanitized.length !== 7) {
      throw new DomainException('Placa deve conter 7 caracteres');
    }

    if (!BRAZILIAN_PLATE_PATTERN.test(sanitized)) {
      throw new DomainException('Placa inválida - formato deve ser ABC1D23');
    }

    return new PlacaVeiculoVo(sanitized);
  }

  equals(other: PlacaVeiculoVo): boolean {
    return this._valor === other._valor;
  }
}
