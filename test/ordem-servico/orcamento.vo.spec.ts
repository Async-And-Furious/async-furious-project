import Decimal from 'decimal.js';
import { OrcamentoVo } from '../../src/modules/ordem-servico/domain/value-objects/orcamento.vo';

describe('OrcamentoVo', () => {
  describe('create', () => {
    it('should create with valid values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 100,
        valor_total_pecas: 50,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('100');
      expect(orcamento.getValorTotalPecas().toString()).toBe('50');
      expect(orcamento.getValorTotalGeral().toString()).toBe('150');
    });

    it('should create with Decimal values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: new Decimal('123.45'),
        valor_total_pecas: new Decimal('67.89'),
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('123.45');
      expect(orcamento.getValorTotalPecas().toString()).toBe('67.89');
      expect(orcamento.getValorTotalGeral().toString()).toBe('191.34');
    });

    it('should create with zero values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 0,
        valor_total_pecas: 0,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('0');
      expect(orcamento.getValorTotalPecas().toString()).toBe('0');
      expect(orcamento.getValorTotalGeral().toString()).toBe('0');
    });
  });

  describe('validations', () => {
    it('should throw when valor_total_servicos is negative', () => {
      expect(() =>
        OrcamentoVo.create({
          valor_total_servicos: -100,
          valor_total_pecas: 50,
        })
      ).toThrow('Valores do orçamento não podem ser negativos');
    });

    it('should throw when valor_total_pecas is negative', () => {
      expect(() =>
        OrcamentoVo.create({
          valor_total_servicos: 100,
          valor_total_pecas: -50,
        })
      ).toThrow('Valores do orçamento não podem ser negativos');
    });

    it('should throw when both values are negative', () => {
      expect(() =>
        OrcamentoVo.create({
          valor_total_servicos: -100,
          valor_total_pecas: -50,
        })
      ).toThrow('Valores do orçamento não podem ser negativos');
    });
  });

  describe('total calculations - edge cases', () => {
    it('should handle large decimal values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: new Decimal('9999999.99'),
        valor_total_pecas: new Decimal('9999999.99'),
      });

      expect(orcamento.getValorTotalGeral().toString()).toBe('19999999.98');
    });

    it('should maintain precision with many decimal places', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: new Decimal('10.123456'),
        valor_total_pecas: new Decimal('20.654321'),
      });

      expect(orcamento.getValorTotalGeral().toString()).toBe('30.777777');
    });

    it('should handle services only (zero parts)', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 500,
        valor_total_pecas: 0,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('500');
      expect(orcamento.getValorTotalPecas().toString()).toBe('0');
      expect(orcamento.getValorTotalGeral().toString()).toBe('500');
    });

    it('should handle parts only (zero services)', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 0,
        valor_total_pecas: 300,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('0');
      expect(orcamento.getValorTotalPecas().toString()).toBe('300');
      expect(orcamento.getValorTotalGeral().toString()).toBe('300');
    });
  });
});
