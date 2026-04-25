import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClienteDto } from '../../src/modules/cadastro/presentation/dto/cliente.dto';

describe('CreateClienteDto', () => {
  it('should validate when CPF is valid for CPF type', async () => {
    const dto = plainToInstance(CreateClienteDto, {
      nome: 'Cliente CPF',
      email: 'cliente-cpf@test.com',
      documento: '52998224725',
      tipo_documento: 'CPF',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should validate when CNPJ is valid for CNPJ type', async () => {
    const dto = plainToInstance(CreateClienteDto, {
      nome: 'Cliente CNPJ',
      email: 'cliente-cnpj@test.com',
      documento: '11222333000181',
      tipo_documento: 'CNPJ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when CPF is invalid for CPF type', async () => {
    const dto = plainToInstance(CreateClienteDto, {
      nome: 'Cliente CPF',
      email: 'cliente-cpf@test.com',
      documento: '12345678901',
      tipo_documento: 'CPF',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'documento')).toBe(true);
  });

  it('should fail when CNPJ is invalid for CNPJ type', async () => {
    const dto = plainToInstance(CreateClienteDto, {
      nome: 'Cliente CNPJ',
      email: 'cliente-cnpj@test.com',
      documento: '12345678000199',
      tipo_documento: 'CNPJ',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'documento')).toBe(true);
  });

  it('should fail when documento type does not match tipo_documento', async () => {
    const dto = plainToInstance(CreateClienteDto, {
      nome: 'Cliente mismatch',
      email: 'cliente-mismatch@test.com',
      documento: '11222333000181',
      tipo_documento: 'CPF',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'documento')).toBe(true);
  });
});
