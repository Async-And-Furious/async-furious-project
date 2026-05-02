import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';

describe('Pagamento Entity', () => {
  describe('criar', () => {
    it('should create a pagamento with AGUARDANDO_PAGAMENTO status', () => {
      const pagamento = Pagamento.criar('os-123', 100);

      expect(pagamento.getOrdemServicoId()).toBe('os-123');
      expect(pagamento.getValor()).toBe(100);
      expect(pagamento.getStatus()).toBe('AGUARDANDO_PAGAMENTO');
      expect(pagamento.getId()).toBeDefined();
    });

    it('should throw DomainException when valor is zero', () => {
      expect(() => Pagamento.criar('os-123', 0)).toThrow(DomainException);
    });

    it('should throw DomainException when valor is negative', () => {
      expect(() => Pagamento.criar('os-123', -50)).toThrow(DomainException);
    });
  });

  describe('registrar', () => {
    it('should change status to PAGO', () => {
      const pagamento = Pagamento.criar('os-123', 100);

      pagamento.registrar();

      expect(pagamento.getStatus()).toBe('PAGO');
    });
  });

  describe('getters', () => {
    it('should return all properties correctly', () => {
      const pagamento = Pagamento.criar('os-123', 250.5);

      expect(pagamento.getId()).toBeDefined();
      expect(pagamento.getOrdemServicoId()).toBe('os-123');
      expect(pagamento.getValor()).toBe(250.5);
      expect(pagamento.getStatus()).toBe('AGUARDANDO_PAGAMENTO');
    });
  });
});
