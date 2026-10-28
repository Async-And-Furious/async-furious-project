import { VeiculoRepository } from '../../../src/modules/cadastro/infrastructure/repositories/veiculo.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

describe('VeiculoRepository', () => {
  let prisma: { veiculo: { findMany: jest.Mock; count: jest.Mock } };
  let repository: VeiculoRepository;

  beforeEach(() => {
    prisma = {
      veiculo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
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
});
