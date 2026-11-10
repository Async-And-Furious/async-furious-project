import { Test, TestingModule } from '@nestjs/testing';
import { OsPecaRepository } from '../../../src/modules/ordem-servico/infrastructure/repositories/os-peca.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

interface MockPrismaOsPeca {
  deleteMany: jest.Mock;
  createMany: jest.Mock;
  findMany: jest.Mock;
}

interface MockPrismaService {
  $transaction: jest.Mock;
  osPeca: MockPrismaOsPeca;
}

describe('OsPecaRepository', () => {
  let repository: OsPecaRepository;
  let mockPrismaService: MockPrismaService;

  const mockOsPecaData = [
    {
      id: 'os-peca-1',
      id_ordem_servico: 'os-123',
      id_peca: 'peca-1',
      quantidade: 2,
      preco_unitario: 50.0,
      valor_total: 100.0,
    },
    {
      id: 'os-peca-2',
      id_ordem_servico: 'os-123',
      id_peca: 'peca-2',
      quantidade: 1,
      preco_unitario: 75.0,
      valor_total: 75.0,
    },
  ];

  beforeEach(async () => {
    mockPrismaService = {
      $transaction: jest.fn((callback) =>
        callback({
          osPeca: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
            findMany: jest.fn(),
          },
        })
      ),
      osPeca: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OsPecaRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<OsPecaRepository>(OsPecaRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('replaceAll', () => {
    it('should delete existing pecas and create new ones', async () => {
      const pecas = [
        { id_peca: 'peca-1', quantidade: 2, preco_unitario: 50.0, valor_total: 100.0 },
        { id_peca: 'peca-2', quantidade: 1, preco_unitario: 75.0, valor_total: 75.0 },
      ];

      await repository.replaceAll('os-123', pecas);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should only delete when pecas array is empty', async () => {
      const transactionMock = jest.fn().mockImplementation((callback) => {
        const tx = {
          osPeca: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn(),
            findMany: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrismaService.$transaction = transactionMock;

      await repository.replaceAll('os-123', []);

      expect(transactionMock).toHaveBeenCalled();
    });

    it('should handle single peca', async () => {
      const pecas = [
        { id_peca: 'peca-1', quantidade: 1, preco_unitario: 100.0, valor_total: 100.0 },
      ];

      const transactionMock = jest.fn().mockImplementation((callback) => {
        const tx = {
          osPeca: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
            findMany: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrismaService.$transaction = transactionMock;

      await repository.replaceAll('os-123', pecas);

      expect(transactionMock).toHaveBeenCalled();
    });
  });

  describe('findByOrdemServicoId', () => {
    it('should return array of OsPeca for given ordemServicoId', async () => {
      mockPrismaService.osPeca.findMany.mockResolvedValue(mockOsPecaData);

      const result = await repository.findByOrdemServicoId('os-123');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.osPeca.findMany).toHaveBeenCalledWith({
        where: { id_ordem_servico: 'os-123' },
      });
    });

    it('should return empty array when no pecas found', async () => {
      mockPrismaService.osPeca.findMany.mockResolvedValue([]);

      const result = await repository.findByOrdemServicoId('os-nonexistent');

      expect(result).toHaveLength(0);
    });
  });
});
