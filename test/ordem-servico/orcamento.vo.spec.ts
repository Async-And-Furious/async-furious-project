import { Decimal } from '@prisma/client/runtime/library';
import { OrcamentoVo } from '../../src/modules/ordem-servico/domain/value-objects/orcamento.vo';

describe('OrcamentoVo', () => {
  describe('create - Factory method básico', () => {
    it('should create a new Orcamento with valid values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 100,
        valor_total_pecas: 50,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('100');
      expect(orcamento.getValorTotalPecas().toString()).toBe('50');
      expect(orcamento.getValorTotalGeral().toString()).toBe('150');
      expect(orcamento.isAprovado()).toBe(false);
    });

    it('should create a new Orcamento with Decimal values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: new Decimal('123.45'),
        valor_total_pecas: new Decimal('67.89'),
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('123.45');
      expect(orcamento.getValorTotalPecas().toString()).toBe('67.89');
      expect(orcamento.getValorTotalGeral().toString()).toBe('191.34');
      expect(orcamento.isAprovado()).toBe(false);
    });

    it('should create a new Orcamento with zero values', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 0,
        valor_total_pecas: 0,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('0');
      expect(orcamento.getValorTotalPecas().toString()).toBe('0');
      expect(orcamento.getValorTotalGeral().toString()).toBe('0');
    });
  });

  describe('createAprovado - Factory method com aprovação', () => {
    it('should create a new approved Orcamento', () => {
      const orcamento = OrcamentoVo.createAprovado({
        valor_total_servicos: 200,
        valor_total_pecas: 80,
      });

      expect(orcamento.getValorTotalServicos().toString()).toBe('200');
      expect(orcamento.getValorTotalPecas().toString()).toBe('80');
      expect(orcamento.getValorTotalGeral().toString()).toBe('280');
      expect(orcamento.isAprovado()).toBe(true);
    });

    it('should ignore aprovado flag when using createAprovado', () => {
      const orcamento = OrcamentoVo.createAprovado({
        valor_total_servicos: 100,
        valor_total_pecas: 50,
        aprovado: false,
      });

      expect(orcamento.isAprovado()).toBe(true);
    });
  });

  describe('createFromItems - Factory method com arrays de valores', () => {
    it('should create Orcamento from arrays of service and part values', () => {
      const servicos = [100, 50, 25];
      const pecas = [30, 20];

      const orcamento = OrcamentoVo.createFromItems(servicos, pecas);

      expect(orcamento.getValorTotalServicos().toString()).toBe('175');
      expect(orcamento.getValorTotalPecas().toString()).toBe('50');
      expect(orcamento.getValorTotalGeral().toString()).toBe('225');
    });

    it('should create Orcamento from arrays with Decimal values', () => {
      const servicos = [new Decimal('50.50'), new Decimal('49.50')];
      const pecas = [new Decimal('25.25'), new Decimal('24.75')];

      const orcamento = OrcamentoVo.createFromItems(servicos, pecas);

      expect(orcamento.getValorTotalServicos().toString()).toBe('100');
      expect(orcamento.getValorTotalPecas().toString()).toBe('50');
      expect(orcamento.getValorTotalGeral().toString()).toBe('150');
    });

    it('should create Orcamento from empty arrays', () => {
      const orcamento = OrcamentoVo.createFromItems([], []);

      expect(orcamento.getValorTotalServicos().toString()).toBe('0');
      expect(orcamento.getValorTotalPecas().toString()).toBe('0');
      expect(orcamento.getValorTotalGeral().toString()).toBe('0');
    });
  });

  describe('Validations', () => {
    it('should throw error when valor_total_servicos is negative', () => {
      expect(() =>
        OrcamentoVo.create({
          valor_total_servicos: -100,
          valor_total_pecas: 50,
        })
      ).toThrow('Valores do orçamento não podem ser negativos');
    });

    it('should throw error when valor_total_pecas is negative', () => {
      expect(() =>
        OrcamentoVo.create({
          valor_total_servicos: 100,
          valor_total_pecas: -50,
        })
      ).toThrow('Valores do orçamento não podem ser negativos');
    });

    it('should throw error when both values are negative', () => {
      expect(() =>
        OrcamentoVo.create({
          valor_total_servicos: -100,
          valor_total_pecas: -50,
        })
      ).toThrow('Valores do orçamento não podem ser negativos');
    });
  });

  describe('toDTO - Serialization', () => {
    it('should convert Orcamento to DTO format', () => {
      const orcamento = OrcamentoVo.create({
        valor_total_servicos: 123.45,
        valor_total_pecas: 67.89,
      });

      const dto = orcamento.toDTO();

      expect(dto).toEqual({
        valor_total_servicos: '123.45',
        valor_total_pecas: '67.89',
        valor_total_geral: '191.34',
        aprovado: false,
      });
    });

    it('should convert approved Orcamento to DTO format', () => {
      const orcamento = OrcamentoVo.createAprovado({
        valor_total_servicos: 100,
        valor_total_pecas: 50,
      });

      const dto = orcamento.toDTO();

      expect(dto).toEqual({
        valor_total_servicos: '100',
        valor_total_pecas: '50',
        valor_total_geral: '150',
        aprovado: true,
      });
    });
  });

  describe('Total calculations - Edge cases', () => {
    it('should handle large decimal values correctly', () => {
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
