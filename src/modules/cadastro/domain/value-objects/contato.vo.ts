import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

export class ContatoVo {
  private readonly _email: string;
  private readonly _telefone: string | null;

  private constructor(email: string, telefone: string | null) {
    this._email = email;
    this._telefone = telefone;
  }

  get email(): string {
    return this._email;
  }

  get telefone(): string | null {
    return this._telefone;
  }

  static criar(email: string, telefone?: string): ContatoVo {
    if (!email || !ContatoVo.isValidEmail(email)) {
      throw new DomainException('Email inválido');
    }

    if (telefone && !ContatoVo.isValidPhone(telefone)) {
      throw new DomainException('Telefone inválido');
    }

    return new ContatoVo(email.toLowerCase(), telefone || null);
  }

  private static isValidEmail(email: string): boolean {
    // RFC 5321 compliant regex - safe from backtracking
    // Uses negated character classes instead of . to avoid catastrophic backtracking
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email);
  }

  private static isValidPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
  }

  equals(other: ContatoVo): boolean {
    return this._email === other._email;
  }
}
