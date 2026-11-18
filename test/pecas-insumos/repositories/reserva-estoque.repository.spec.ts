import { Test, TestingModule } from '@nestjs/testing';
import { ReservaEstoqueRepository } from '../../../src/modules/pecas-insumos/infrastructure/repositories/reserva-estoque.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

interface MockPrismaReservaEstoque {
  create: jest.Mock;
  count: jest.Mock;
  findMany: jest.Mock;
}

interface MockTx {
  reservaEstoque: { findMany: jest.Mock; deleteMany: jest.Mock };
  peca: { update: jest.Mock };
}

interface MockPrismaService {
  reservaEstoque: MockPrismaReservaEstoque;
  $transaction: jest.Mock;
}

describe('ReservaEstoqueRepository', () => {
  let repository: ReservaEstoqueRepository;
  let mockPrismaService: MockPrismaService;
  let tx: MockTx;

  const mockReservaData = {
    id: 'reserva-1',
    ordem_id: 'os-123',
    peca_id: 'peca-1',
    quantidade: 5,
    reservado_em: new Date(),
  };

  beforeEach(async () => {
    tx = {
      reservaEstoque: { findMany: jest.fn(), deleteMany: jest.fn() },
      peca: { update: jest.fn() },
    };
    mockPrismaService = {
      reservaEstoque: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((fn: (client: MockTx) => Promise<unknown>) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservaEstoqueRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<ReservaEstoqueRepository>(ReservaEstoqueRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('should create a reserva', async () => {
      mockPrismaService.reservaEstoque.create.mockResolvedValue(mockReservaData);

      const result = await repository.save({
        ordem_id: 'os-123',
        peca_id: 'peca-1',
        quantidade: 5,
      });

      expect(result.ordem_id).toBe('os-123');
      expect(result.peca_id).toBe('peca-1');
      expect(result.quantidade).toBe(5);
      expect(mockPrismaService.reservaEstoque.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ordem_id: 'os-123',
          peca_id: 'peca-1',
          quantidade: 5,
          reservado_em: expect.any(Date),
        }),
      });
    });
  });

  describe('existsByOrdemId', () => {
    it('should return true when reserva exists', async () => {
      mockPrismaService.reservaEstoque.count.mockResolvedValue(1);

      const result = await repository.existsByOrdemId('os-123');

      expect(result).toBe(true);
      expect(mockPrismaService.reservaEstoque.count).toHaveBeenCalledWith({
        where: { ordem_id: 'os-123' },
      });
    });

    it('should return false when no reserva exists', async () => {
      mockPrismaService.reservaEstoque.count.mockResolvedValue(0);

      const result = await repository.existsByOrdemId('os-nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findByOrdemId', () => {
    it('should return reservas for ordem', async () => {
      mockPrismaService.reservaEstoque.findMany.mockResolvedValue([mockReservaData]);

      const result = await repository.findByOrdemId('os-123');

      expect(result).toHaveLength(1);
      expect(result[0].ordem_id).toBe('os-123');
      expect(mockPrismaService.reservaEstoque.findMany).toHaveBeenCalledWith({
        where: { ordem_id: 'os-123' },
      });
    });

    it('should return empty array when no reservas', async () => {
      mockPrismaService.reservaEstoque.findMany.mockResolvedValue([]);

      const result = await repository.findByOrdemId('os-nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('releaseByOrdemId (#338)', () => {
    const reserva = (id: string, peca_id: string, quantidade: number) => ({
      ...mockReservaData,
      id,
      peca_id,
      quantidade,
    });

    it('devolve ao estoque cada reserva da OS e apaga a linha, numa transação', async () => {
      tx.reservaEstoque.findMany.mockResolvedValue([
        reserva('r-1', 'peca-1', 3),
        reserva('r-2', 'peca-2', 1),
      ]);
      tx.reservaEstoque.deleteMany.mockResolvedValue({ count: 1 });

      const devolvidas = await repository.releaseByOrdemId('os-123');

      expect(devolvidas).toBe(2);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.reservaEstoque.findMany).toHaveBeenCalledWith({ where: { ordem_id: 'os-123' } });
      expect(tx.reservaEstoque.deleteMany).toHaveBeenCalledWith({ where: { id: 'r-1' } });
      expect(tx.peca.update).toHaveBeenCalledWith({
        where: { id: 'peca-1' },
        data: { quantidade_estoque: { increment: 3 } },
      });
      expect(tx.peca.update).toHaveBeenCalledWith({
        where: { id: 'peca-2' },
        data: { quantidade_estoque: { increment: 1 } },
      });
    });

    it('não devolve a reserva que outra liberação já apagou (idempotente)', async () => {
      tx.reservaEstoque.findMany.mockResolvedValue([reserva('r-1', 'peca-1', 3)]);
      tx.reservaEstoque.deleteMany.mockResolvedValue({ count: 0 });

      const devolvidas = await repository.releaseByOrdemId('os-123');

      expect(devolvidas).toBe(0);
      expect(tx.peca.update).not.toHaveBeenCalled();
    });

    it('sem reservas, não toca no estoque', async () => {
      tx.reservaEstoque.findMany.mockResolvedValue([]);

      await expect(repository.releaseByOrdemId('os-123')).resolves.toBe(0);
      expect(tx.peca.update).not.toHaveBeenCalled();
    });
  });
});
