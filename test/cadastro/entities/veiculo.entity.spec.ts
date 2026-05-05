import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { Veiculo } from '../../../src/modules/cadastro/domain/entities/veiculo.entity';

describe('Veiculo Entity', () => {
  describe('criar', () => {
    it('should create a valid veiculo', () => {
      const veiculo = Veiculo.criar({
        id: 'veic-1',
        placa: 'ABC1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cli-1',
      });

      expect((veiculo as any)._id).toBe('veic-1');
      expect(veiculo.marca).toBe('Toyota');
    });

    it('should throw when id is missing', () => {
      expect(() =>
        Veiculo.criar({
          id: '',
          placa: 'ABC1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2020,
          clienteId: 'cli-1',
        })
      ).toThrow(DomainException);
    });

    it('should throw when marca is empty', () => {
      expect(() =>
        Veiculo.criar({
          id: 'veic-1',
          placa: 'ABC1234',
          marca: '',
          modelo: 'Corolla',
          ano: 2020,
          clienteId: 'cli-1',
        })
      ).toThrow(DomainException);
    });

    it('should throw when marca is whitespace', () => {
      expect(() =>
        Veiculo.criar({
          id: 'veic-1',
          placa: 'ABC1234',
          marca: '   ',
          modelo: 'Corolla',
          ano: 2020,
          clienteId: 'cli-1',
        })
      ).toThrow(DomainException);
    });

    it('should throw when modelo is empty', () => {
      expect(() =>
        Veiculo.criar({
          id: 'veic-1',
          placa: 'ABC1234',
          marca: 'Toyota',
          modelo: '',
          ano: 2020,
          clienteId: 'cli-1',
        })
      ).toThrow(DomainException);
    });

    it('should throw when ano is before 1900', () => {
      expect(() =>
        Veiculo.criar({
          id: 'veic-1',
          placa: 'ABC1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 1899,
          clienteId: 'cli-1',
        })
      ).toThrow(DomainException);
    });

    it('should throw when ano is too far in future', () => {
      expect(() =>
        Veiculo.criar({
          id: 'veic-1',
          placa: 'ABC1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: new Date().getFullYear() + 2,
          clienteId: 'cli-1',
        })
      ).toThrow(DomainException);
    });

    it('should trim marca and modelo', () => {
      const veiculo = Veiculo.criar({
        id: 'veic-1',
        placa: 'ABC1234',
        marca: '  Toyota  ',
        modelo: '  Corolla  ',
        ano: 2020,
        clienteId: 'cli-1',
      });

      expect(veiculo.marca).toBe('Toyota');
      expect(veiculo.modelo).toBe('Corolla');
    });

    it('should handle optional cor', () => {
      const veiculo = Veiculo.criar({
        id: 'veic-1',
        placa: 'ABC1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Preto',
        clienteId: 'cli-1',
      });

      expect(veiculo.cor).toBe('Preto');
    });
  });

  describe('equals', () => {
    it('should return true for same id', () => {
      const v1 = Veiculo.criar({
        id: 'veic-1',
        placa: 'ABC1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cli-1',
      });

      const v2 = Veiculo.criar({
        id: 'veic-1',
        placa: 'XYZ5678',
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2021,
        clienteId: 'cli-2',
      });

      expect(v1.equals(v2)).toBe(true);
    });

    it('should return false for different id', () => {
      const v1 = Veiculo.criar({
        id: 'veic-1',
        placa: 'ABC1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cli-1',
      });

      const v2 = Veiculo.criar({
        id: 'veic-2',
        placa: 'ABC1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cli-1',
      });

      expect(v1.equals(v2 as any)).toBe(false);
    });
  });
});
