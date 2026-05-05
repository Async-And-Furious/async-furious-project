import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { Cliente } from '../../../src/modules/cadastro/domain/entities/cliente.entity';
import { TipoDocumento } from '../../../src/modules/cadastro/domain/value-objects/cpf-cnpj.vo';

describe('Cliente Entity', () => {
  describe('criar', () => {
    const validProps = {
      id: 'cliente-123',
      nome: 'João Silva',
      email: 'joao@example.com',
      documento: '00000000191',
      tipoDocumento: 'CPF' as TipoDocumento,
    };

    it('should create cliente with valid data', () => {
      const cliente = Cliente.criar(validProps);

      expect(cliente.id).toBe('cliente-123');
      expect(cliente.nome).toBe('João Silva');
    });

    it('should throw DomainException when id is empty', () => {
      expect(() =>
        Cliente.criar({
          ...validProps,
          id: '',
        })
      ).toThrow(DomainException);
    });

    it('should throw DomainException when id is undefined', () => {
      expect(() =>
        Cliente.criar({
          ...validProps,
          id: undefined as any,
        })
      ).toThrow(DomainException);
    });

    it('should throw DomainException when nome is empty', () => {
      expect(() =>
        Cliente.criar({
          ...validProps,
          nome: '',
        })
      ).toThrow(DomainException);
    });

    it('should throw DomainException when nome is only whitespace', () => {
      expect(() =>
        Cliente.criar({
          ...validProps,
          nome: '   ',
        })
      ).toThrow(DomainException);
    });

    it('should trim nome when creating cliente', () => {
      const cliente = Cliente.criar({
        ...validProps,
        nome: '  João Silva  ',
      });

      expect(cliente.nome).toBe('João Silva');
    });
  });

  describe('equals', () => {
    it('should return true when ids are equal', () => {
      const cliente1 = Cliente.criar({
        id: 'cliente-123',
        nome: 'João Silva',
        email: 'joao@example.com',
        documento: '00000000191',
        tipoDocumento: 'CPF' as TipoDocumento,
      });

      const cliente2 = Cliente.criar({
        id: 'cliente-123',
        nome: 'João Different',
        email: 'different@example.com',
        documento: '987.654.321-00',
        tipoDocumento: 'CPF' as TipoDocumento,
      });

      expect(cliente1.equals(cliente2)).toBe(true);
    });

    it('should return false when ids are different', () => {
      const cliente1 = Cliente.criar({
        id: 'cliente-123',
        nome: 'João Silva',
        email: 'joao@example.com',
        documento: '00000000191',
        tipoDocumento: 'CPF' as TipoDocumento,
      });

      const cliente2 = Cliente.criar({
        id: 'cliente-456',
        nome: 'João Silva',
        email: 'joao@example.com',
        documento: '00000000191',
        tipoDocumento: 'CPF' as TipoDocumento,
      });

      expect(cliente1.equals(cliente2)).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return all properties correctly', () => {
      const cliente = Cliente.criar({
        id: 'cliente-123',
        nome: 'João Silva',
        email: 'joao@example.com',
        telefone: '11999999999',
        documento: '00000000191',
        tipoDocumento: 'CPF' as TipoDocumento,
      });

      expect(cliente.id).toBe('cliente-123');
      expect(cliente.nome).toBe('João Silva');
      expect(cliente.contato).toBeDefined();
      expect(cliente.cpfCnpj).toBeDefined();
    });
  });
});
