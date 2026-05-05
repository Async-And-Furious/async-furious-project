import { Cliente } from '../../domain/entities/cliente.entity';
import { ClienteMapper, ClienteORMEntity } from './cliente.orm-entity';

describe('ClienteMapper', () => {
  const validCpf = '11144477735';
  const validCnpj = '11222333000181';

  describe('toDomain', () => {
    it('should convert ORM entity to domain', () => {
      const orm: ClienteORMEntity = {
        id: 'cli-1',
        nome: 'Test Client',
        email: 'test@test.com',
        telefone: '11999999999',
        documento: validCpf,
        tipo_documento: 'CPF',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const domain = ClienteMapper.toDomain(orm);

      expect(domain.id).toBe('cli-1');
      expect(domain.nome).toBe('Test Client');
    });

    it('should handle null telefone', () => {
      const orm: ClienteORMEntity = {
        id: 'cli-1',
        nome: 'Test Client',
        email: 'test@test.com',
        telefone: null,
        documento: validCpf,
        tipo_documento: 'CPF',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const domain = ClienteMapper.toDomain(orm);

      expect(domain.contato.telefone).toBeNull();
    });

    it('should handle CNPJ', () => {
      const orm: ClienteORMEntity = {
        id: 'cli-1',
        nome: 'Company',
        email: 'company@company.com',
        telefone: null,
        documento: validCnpj,
        tipo_documento: 'CNPJ',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const domain = ClienteMapper.toDomain(orm);

      expect(domain.cpfCnpj.tipo).toBe('CNPJ');
    });
  });

  describe('toOrm', () => {
    it('should convert domain to ORM', () => {
      const domain = Cliente.criar({
        id: 'cli-1',
        nome: 'Test Client',
        email: 'test@test.com',
        telefone: '11999999999',
        documento: validCpf,
        tipoDocumento: 'CPF',
      });

      const orm = ClienteMapper.toOrm(domain);

      expect(orm.id).toBe('cli-1');
      expect(orm.nome).toBe('Test Client');
      expect(orm.email).toBe('test@test.com');
      expect(orm.telefone).toBe('11999999999');
      expect(orm.documento).toBe(validCpf);
      expect(orm.tipo_documento).toBe('CPF');
    });

    it('should handle domain without telefone', () => {
      const domain = Cliente.criar({
        id: 'cli-1',
        nome: 'Test Client',
        email: 'test@test.com',
        documento: validCpf,
        tipoDocumento: 'CPF',
      });

      const orm = ClienteMapper.toOrm(domain);

      expect(orm.telefone).toBeNull();
    });
  });
});
