import { VeiculoRepository } from '../../../src/modules/cadastro/infrastructure/repositories/veiculo.repository';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import { ConflitoException } from '../../../src/shared/domain/exceptions/conflito.exception';

describe('VeiculoRepository', () => {
  const veiculo = {
    id: 'vei-1',
    placa: 'ABC1D23',
    marca: 'Fiat',
    modelo: 'Uno',
    ano: 2015,
    cor: null,
    id_cliente: 'cli-1',
    created_at: new Date(),
    updated_at: new Date(),
  };
  let prisma: {
    veiculo: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
    ordemServico: { count: jest.Mock };
  };
  let repository: VeiculoRepository;

  beforeEach(() => {
    prisma = {
      veiculo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(veiculo),
        delete: jest.fn().mockResolvedValue(veiculo),
      },
      ordemServico: { count: jest.fn().mockResolvedValue(0) },
    };
    repository = new VeiculoRepository(prisma as unknown as PrismaService);
  });

  it('pages from the first record with 10 items when no pagination is given', async () => {
    const result = await repository.findAll();

    expect(prisma.veiculo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    );
    expect(result.pagination).toMatchObject({ page: 1, limit: 10, total: 0 });
  });

  it('skips the previous pages for the requested page and limit', async () => {
    await repository.findAll(3, 5);

    expect(prisma.veiculo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });

  describe('remove (#378, item 2)', () => {
    it('apaga o veículo sem OS', async () => {
      await repository.remove('vei-1');

      expect(prisma.ordemServico.count).toHaveBeenCalledWith({ where: { id_veiculo: 'vei-1' } });
      expect(prisma.veiculo.delete).toHaveBeenCalledWith({ where: { id: 'vei-1' } });
    });

    it('veículo com OS responde 409 e não apaga nada', async () => {
      prisma.ordemServico.count.mockResolvedValue(2);

      await expect(repository.remove('vei-1')).rejects.toBeInstanceOf(ConflitoException);
      expect(prisma.veiculo.delete).not.toHaveBeenCalled();
    });

    it('OS aberta entre a checagem e o delete: a FK Restrict vira 409', async () => {
      prisma.veiculo.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: 'test',
        })
      );

      await expect(repository.remove('vei-1')).rejects.toBeInstanceOf(ConflitoException);
    });
  });
});
