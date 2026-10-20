import { Test, TestingModule } from '@nestjs/testing';
import { PagamentoRepository } from '../../../src/modules/financeiro/infrastructure/repositories/pagamento.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';

interface MockPrismaPagamento {
  upsert: jest.Mock;
  findUnique: jest.Mock;
  findFirst: jest.Mock;
}

interface MockPrismaService {
  pagamento: MockPrismaPagamento;
}

describe('PagamentoRepository', () => {
  let repository: PagamentoRepository;
  let mockPrismaService: MockPrismaService;

  const mockPagamentoData = {
    id: 'pag-123',
    ordemServicoId: 'os-123',
    valor: 100.0,
    status: 'AGUARDANDO_PAGAMENTO',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      pagamento: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagamentoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<PagamentoRepository>(PagamentoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('should upsert pagamento', async () => {
      const pagamento = Pagamento.criar('os-123', 100);

      await repository.save(pagamento as unknown as Pagamento);

      expect(mockPrismaService.pagamento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: expect.any(String) }),
          create: expect.any(Object),
          update: expect.any(Object),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return pagamento when found', async () => {
      mockPrismaService.pagamento.findUnique.mockResolvedValue(mockPagamentoData);

      const result = await repository.findById('pag-123');

      expect(result).toBeDefined();
      expect(mockPrismaService.pagamento.findUnique).toHaveBeenCalledWith({
        where: { id: 'pag-123' },
      });
    });

    it('should return null when not found', async () => {
      mockPrismaService.pagamento.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
      expect(mockPrismaService.pagamento.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      });
    });
  });

  describe('findCobrancaByOrdemServicoId', () => {
    it('should return the latest pagamento with a payment link', async () => {
      mockPrismaService.pagamento.findFirst.mockResolvedValue({
        ...mockPagamentoData,
        preferenceId: 'pref-1',
        linkPagamento: 'https://mp.test/checkout/pref-1',
      });

      const result = await repository.findCobrancaByOrdemServicoId('os-123');

      expect(result?.getLinkPagamento()).toBe('https://mp.test/checkout/pref-1');
      expect(mockPrismaService.pagamento.findFirst).toHaveBeenCalledWith({
        where: { ordemServicoId: 'os-123', linkPagamento: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return null when there is no charge for the ordem de serviço', async () => {
      mockPrismaService.pagamento.findFirst.mockResolvedValue(null);

      const result = await repository.findCobrancaByOrdemServicoId('os-123');

      expect(result).toBeNull();
    });
  });
});
