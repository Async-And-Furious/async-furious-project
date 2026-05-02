import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { Cliente } from '@/modules/cadastro/domain/entities/cliente.entity';
import { Veiculo } from '@/modules/cadastro/domain/entities/veiculo.entity';
import { Servico } from '@/modules/cadastro/domain/entities/servico.entity';

export function makeCliente(overrides: Partial<Parameters<typeof Cliente.criar>[0]> = {}): Cliente {
  return Cliente.criar({
    id: '123e4567-e89b-12d3-a456-426614174000',
    nome: 'João Silva',
    documento: '11144477735',
    tipoDocumento: 'CPF',
    email: 'joao@email.com',
    telefone: '11999999999',
    ...overrides,
  });
}

export function makeVeiculo(overrides: Partial<Parameters<typeof Veiculo.criar>[0]> = {}): Veiculo {
  return Veiculo.criar({
    id: '123e4567-e89b-12d3-a456-426614174000',
    placa: 'ABC-1234',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Branco',
    clienteId: 'cliente1',
    ...overrides,
  });
}

export function makeServico(overrides: Partial<Servico> = {}): Servico {
  const s = new Servico();
  s.id = overrides.id ?? '123e4567-e89b-12d3-a456-426614174000';
  s.nome = overrides.nome ?? 'Troca de Óleo';
  s.descricao = 'descricao' in overrides ? (overrides.descricao ?? null) : 'Troca de óleo do motor';
  s.preco = overrides.preco ?? 50.0;
  s.created_at = overrides.created_at ?? new Date();
  s.updated_at = overrides.updated_at ?? new Date();
  return s;
}

export function makePagination(
  overrides: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}
): { page: number; limit: number; total: number; totalPages: number } {
  return { page: 1, limit: 10, total: 2, totalPages: 1, ...overrides };
}

export async function expectFieldError<T extends object>(
  DtoClass: new () => T,
  data: object,
  property: string
): Promise<void> {
  const dto = plainToClass(DtoClass, data);
  const errors = await validate(dto as object);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0].property).toBe(property);
}

export async function expectNoErrors<T extends object>(
  DtoClass: new () => T,
  data: object
): Promise<void> {
  const dto = plainToClass(DtoClass, data);
  const errors = await validate(dto as object);
  expect(errors.length).toBe(0);
}
