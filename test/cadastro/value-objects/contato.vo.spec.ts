import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { ContatoVo } from '../../../src/modules/cadastro/domain/value-objects/contato.vo';

describe('ContatoVo', () => {
  describe('criar', () => {
    it('should create with valid email', () => {
      const contato = ContatoVo.criar('test@example.com');
      expect(contato.email).toBe('test@example.com');
    });

    it('should create with email and telefone', () => {
      const contato = ContatoVo.criar('test@example.com', '11999999999');
      expect(contato.email).toBe('test@example.com');
      expect(contato.telefone).toBe('11999999999');
    });

    it('should throw for invalid email', () => {
      expect(() => ContatoVo.criar('invalid')).toThrow(DomainException);
    });

    it('should throw for empty email', () => {
      expect(() => ContatoVo.criar('')).toThrow(DomainException);
    });

    it('should throw for invalid telefone', () => {
      expect(() => ContatoVo.criar('test@example.com', '123')).toThrow(DomainException);
    });

    it('should throw for telefone with too many digits', () => {
      expect(() => ContatoVo.criar('test@example.com', '119999999999')).toThrow(DomainException);
    });

    it('should lowercase email', () => {
      const contato = ContatoVo.criar('TEST@EXAMPLE.COM');
      expect(contato.email).toBe('test@example.com');
    });
  });

  describe('equals', () => {
    it('should return true for same email', () => {
      const c1 = ContatoVo.criar('test@example.com');
      const c2 = ContatoVo.criar('test@example.com');
      expect(c1.equals(c2)).toBe(true);
    });

    it('should return false for different email', () => {
      const c1 = ContatoVo.criar('test@example.com');
      const c2 = ContatoVo.criar('other@example.com');
      expect(c1.equals(c2)).toBe(false);
    });
  });
});
