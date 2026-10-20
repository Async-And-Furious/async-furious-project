import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';

describe('Pagamento Entity', () => {
  describe('criar', () => {
    it('should create a pagamento with AGUARDANDO_PAGAMENTO status', () => {
      const pagamento = Pagamento.criar('os-123', 100);

      expect(pagamento.getOrdemServicoId()).toBe('os-123');
      expect(pagamento.getValor()).toBe(100);
      expect(pagamento.getStatus()).toBe('AGUARDANDO_PAGAMENTO');
      expect(pagamento.estaPendente()).toBe(true);
      expect(pagamento.getId()).toBeDefined();
    });

    it('should throw DomainException when valor is zero', () => {
      expect(() => Pagamento.criar('os-123', 0)).toThrow(DomainException);
    });

    it('should throw DomainException when valor is negative', () => {
      expect(() => Pagamento.criar('os-123', -50)).toThrow(DomainException);
    });
  });

  describe('confirmar', () => {
    it('should change a pending pagamento to CONFIRMADO and keep the external payment id', () => {
      const pagamento = Pagamento.criar('os-123', 100);

      pagamento.confirmar('mp-1');

      expect(pagamento.getStatus()).toBe('CONFIRMADO');
      expect(pagamento.getPagamentoExternoId()).toBe('mp-1');
      expect(pagamento.estaPendente()).toBe(false);
    });

    it('should throw DomainException when pagamento is not pending', () => {
      const pagamento = Pagamento.criar('os-123', 100);
      pagamento.confirmar('mp-1');

      expect(() => pagamento.confirmar('mp-2')).toThrow(DomainException);
    });
  });

  describe('recusar', () => {
    it('should change a pending pagamento to RECUSADO (terminal)', () => {
      const pagamento = Pagamento.criar('os-123', 100);

      pagamento.recusar('mp-1');

      expect(pagamento.getStatus()).toBe('RECUSADO');
      expect(pagamento.getPagamentoExternoId()).toBe('mp-1');
      expect(() => pagamento.confirmar('mp-2')).toThrow(DomainException);
    });
  });

  describe('vincularCobranca', () => {
    it('should store preference id and payment link on a pending pagamento', () => {
      const pagamento = Pagamento.criar('os-123', 100);

      pagamento.vincularCobranca('pref-1', 'https://mp.test/checkout/pref-1');

      expect(pagamento.getPreferenceId()).toBe('pref-1');
      expect(pagamento.getLinkPagamento()).toBe('https://mp.test/checkout/pref-1');
      expect(pagamento.getStatus()).toBe('AGUARDANDO_PAGAMENTO');
    });

    it('should throw DomainException when pagamento is not pending', () => {
      const pagamento = Pagamento.criar('os-123', 100);
      pagamento.confirmar('mp-1');

      expect(() => pagamento.vincularCobranca('pref-1', 'https://mp.test/x')).toThrow(
        DomainException
      );
    });
  });

  describe('reconstituir', () => {
    it('should accept legacy statuses such as PAGO as non-pending', () => {
      const pagamento = Pagamento.reconstituir({
        id: 'pag-1',
        ordemServicoId: 'os-123',
        valor: 100,
        status: 'PAGO',
      });

      expect(pagamento.estaPendente()).toBe(false);
      expect(pagamento.getPagamentoExternoId()).toBeNull();
    });
  });
});
