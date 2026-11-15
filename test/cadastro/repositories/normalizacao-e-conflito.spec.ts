import { Prisma } from '@prisma/client';
import { ClienteRepository } from '../../../src/modules/cadastro/infrastructure/repositories/cliente.repository';
import { VeiculoRepository } from '../../../src/modules/cadastro/infrastructure/repositories/veiculo.repository';
import { ConflitoException } from '../../../src/shared/domain/exceptions/conflito.exception';
import type { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

// #378, item 5: a busca usa a mesma forma normalizada da gravação, e a
// violação de unicidade vira 409 (ConflitoException) em vez de 500.
const p2002 = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (documento)', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });

describe('ClienteRepository: normalização e conflito', () => {
  const prisma = { cliente: { findFirst: jest.fn(), create: jest.fn() } };
  const repository = new ClienteRepository(prisma as unknown as PrismaService, {
    project: jest.fn(),
  });
  const input = {
    nome: 'Maria',
    email: 'maria@example.com',
    documento: '529.982.247-25',
    tipoDocumento: 'CPF' as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it('busca pelo documento só com dígitos, como ele é gravado', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);

    await repository.findByDocumento('529.982.247-25');

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documento: '52998224725', ativo: true } })
    );
  });

  it('traduz P2002 do create para ConflitoException', async () => {
    prisma.cliente.create.mockRejectedValue(p2002());

    await expect(repository.create(input)).rejects.toThrow(ConflitoException);
  });

  it('propaga erros que não são de unicidade', async () => {
    const falha = new Error('connection reset');
    prisma.cliente.create.mockRejectedValue(falha);

    await expect(repository.create(input)).rejects.toBe(falha);
  });
});

describe('VeiculoRepository: normalização e conflito', () => {
  const prisma = { veiculo: { findUnique: jest.fn(), create: jest.fn() } };
  const repository = new VeiculoRepository(prisma as unknown as PrismaService);
  const input = { placa: 'abc-1d23', marca: 'Fiat', modelo: 'Uno', ano: 2015, clienteId: 'cli-1' };

  beforeEach(() => jest.clearAllMocks());

  it('busca pela placa sem hífen e em maiúscula, como ela é gravada', async () => {
    prisma.veiculo.findUnique.mockResolvedValue(null);

    await repository.findByPlaca('abc-1d23');

    expect(prisma.veiculo.findUnique).toHaveBeenCalledWith({ where: { placa: 'ABC1D23' } });
  });

  it('traduz P2002 do create para ConflitoException', async () => {
    prisma.veiculo.create.mockRejectedValue(p2002());

    await expect(repository.create(input)).rejects.toThrow(ConflitoException);
  });

  it('propaga erros que não são de unicidade', async () => {
    const falha = new Error('connection reset');
    prisma.veiculo.create.mockRejectedValue(falha);

    await expect(repository.create(input)).rejects.toBe(falha);
  });
});
