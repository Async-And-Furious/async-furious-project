import { OsServicoRepository } from '../../../src/modules/ordem-servico/infrastructure/repositories/os-servico.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

describe('OsServicoRepository', () => {
  let tx: {
    osServico: { deleteMany: jest.Mock; createMany: jest.Mock };
  };
  let repository: OsServicoRepository;
  let projector: { project: jest.Mock };

  beforeEach(() => {
    tx = {
      osServico: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    };
    projector = { project: jest.fn().mockResolvedValue(undefined) };
    repository = new OsServicoRepository(prisma as unknown as PrismaService, projector);
  });

  it('clears the services of the order and inserts nothing when the new list is empty', async () => {
    await repository.replaceAll('os-1', []);

    expect(tx.osServico.deleteMany).toHaveBeenCalledWith({
      where: { id_ordem_servico: 'os-1' },
    });
    expect(tx.osServico.createMany).not.toHaveBeenCalled();
  });

  it('replaces the services of the order with the new list in one transaction', async () => {
    await repository.replaceAll('os-1', [
      { id_servico: 'srv-1', quantidade: 2, preco_unitario: 80, valor_total: 160 },
      { id_servico: 'srv-2', quantidade: 1, preco_unitario: 45.5, valor_total: 45.5 },
    ]);

    expect(tx.osServico.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.osServico.createMany).toHaveBeenCalledWith({
      data: [
        {
          id_ordem_servico: 'os-1',
          id_servico: 'srv-1',
          quantidade: 2,
          preco_unitario: 80,
          valor_total: 160,
        },
        {
          id_ordem_servico: 'os-1',
          id_servico: 'srv-2',
          quantidade: 1,
          preco_unitario: 45.5,
          valor_total: 45.5,
        },
      ],
    });
  });

  it('projects the order after replacing its services (write-through)', async () => {
    await repository.replaceAll('os-1', []);

    expect(projector.project).toHaveBeenCalledWith('os-1');
  });
});
