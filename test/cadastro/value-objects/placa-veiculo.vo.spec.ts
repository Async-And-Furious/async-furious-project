import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { PlacaVeiculoVo } from '../../../src/modules/cadastro/domain/value-objects/placa-veiculo.vo';

describe('PlacaVeiculoVo', () => {
  describe('criar', () => {
    it.each([
      ['valid plate', 'ABC1234'],
      ['lowercase', 'abc1234'],
      ['hyphen', 'ABC-1234'],
      ['spaces', 'ABC 1234'],
    ])('should create and normalize with %s', (_description, input) => {
      const placa = PlacaVeiculoVo.criar(input);
      expect(placa.valor).toBe('ABC1234');
    });

    it('should throw for empty plate', () => {
      expect(() => PlacaVeiculoVo.criar('')).toThrow(DomainException);
    });

    it('should throw for null', () => {
      expect(() => PlacaVeiculoVo.criar(null as never)).toThrow(DomainException);
    });

    it('should throw for too short', () => {
      expect(() => PlacaVeiculoVo.criar('ABC123')).toThrow(DomainException);
    });

    it('should throw for too long', () => {
      expect(() => PlacaVeiculoVo.criar('ABC12345')).toThrow(DomainException);
    });

    it('should throw for invalid format (all letters)', () => {
      expect(() => PlacaVeiculoVo.criar('ABCDFFF')).toThrow(DomainException);
    });

    it('should throw for invalid format (all numbers)', () => {
      expect(() => PlacaVeiculoVo.criar('1234567')).toThrow(DomainException);
    });
  });

  describe('equals', () => {
    it('should return true for same value', () => {
      const p1 = PlacaVeiculoVo.criar('ABC1234');
      const p2 = PlacaVeiculoVo.criar('ABC1234');
      expect(p1.equals(p2)).toBe(true);
    });

    it('should return false for different value', () => {
      const p1 = PlacaVeiculoVo.criar('ABC1234');
      const p2 = PlacaVeiculoVo.criar('XYZ5678');
      expect(p1.equals(p2)).toBe(false);
    });
  });
});
