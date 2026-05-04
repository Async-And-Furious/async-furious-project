import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { PlacaVeiculoVo } from '../../../src/modules/cadastro/domain/value-objects/placa-veiculo.vo';

describe('PlacaVeiculoVo', () => {
  describe('criar', () => {
    it('should create with valid plate', () => {
      const placa = PlacaVeiculoVo.criar('ABC1234');
      expect(placa.valor).toBe('ABC1234');
    });

    it('should create with lowercase and normalize', () => {
      const placa = PlacaVeiculoVo.criar('abc1234');
      expect(placa.valor).toBe('ABC1234');
    });

    it('should create with hyphen and normalize', () => {
      const placa = PlacaVeiculoVo.criar('ABC-1234');
      expect(placa.valor).toBe('ABC1234');
    });

    it('should create with spaces and normalize', () => {
      const placa = PlacaVeiculoVo.criar('ABC 1234');
      expect(placa.valor).toBe('ABC1234');
    });

    it('should throw for empty plate', () => {
      expect(() => PlacaVeiculoVo.criar('')).toThrow(DomainException);
    });

    it('should throw for null', () => {
      expect(() => PlacaVeiculoVo.criar(null as any)).toThrow(DomainException);
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
