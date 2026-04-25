import { CpfCnpjVo } from '../../src/modules/cadastro/domain/value-objects/cpf-cnpj.vo';

describe('CpfCnpjVo', () => {
  it('should validate CPF with and without mask', () => {
    expect(CpfCnpjVo.validateCPF('52998224725')).toBe(true);
    expect(CpfCnpjVo.validateCPF('529.982.247-25')).toBe(true);
  });

  it('should validate CNPJ with and without mask', () => {
    expect(CpfCnpjVo.validateCNPJ('11222333000181')).toBe(true);
    expect(CpfCnpjVo.validateCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('should format CPF', () => {
    expect(CpfCnpjVo.formatCPF('52998224725')).toBe('529.982.247-25');
  });

  it('should format CNPJ', () => {
    expect(CpfCnpjVo.formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('should format by type', () => {
    expect(CpfCnpjVo.formatByType('52998224725', 'CPF')).toBe('529.982.247-25');
    expect(CpfCnpjVo.formatByType('11222333000181', 'CNPJ')).toBe('11.222.333/0001-81');
  });

  it('should throw when trying to format invalid CPF', () => {
    expect(() => CpfCnpjVo.formatCPF('12345678901')).toThrow('Invalid CPF');
  });

  it('should throw when trying to format invalid CNPJ', () => {
    expect(() => CpfCnpjVo.formatCNPJ('12345678000199')).toThrow('Invalid CNPJ');
  });
});
