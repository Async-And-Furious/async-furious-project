import { Test, TestingModule } from '@nestjs/testing';
import { OrdemServicoBacklogAdapter } from '../../../src/modules/ordem-servico/infrastructure/adapters/ordem-servico-backlog.adapter';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

interface MockPrismaOrdemServico {
  findMany: jest.Mock;
}

interface MockPrismaService {
  ordemServico: MockPrismaOrdemServico;
}

describe('OrdemServicoBacklogAdapter', () => {
  let adapter: OrdemServicoBacklogAdapter;
  let mockPrismaService: MockPrismaService;

  const mockOrdensServico = [
    {
      id: 'os-1',
      status: 'AWAITING_PARTS',
      osPecas: [
        { id_peca: 'peca-1', quantidade: 2 },
        { id_peca: 'peca-2', quantidade: 1 },
      ],
    },
    {
      id: 'os-2',
      status: 'AWAITING_PARTS',
      osPecas: [{ id_peca: 'peca-3', quantidade: 3 }],
    },
  ];

  beforeEach(async () => {
    mockPrismaService = {
      ordemServico: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdemServicoBacklogAdapter,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    adapter = module.get<OrdemServicoBacklogAdapter>(OrdemServicoBacklogAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllAguardandoPecas', () => {
    it('should return all ordens servico awaiting parts with their pecas', async () => {
      mockPrismaService.ordemServico.findMany.mockResolvedValue(mockOrdensServico);

      const result = await adapter.findAllAguardandoPecas();

      expect(result).toHaveLength(2);
      expect(result[0].ordemId).toBe('os-1');
      expect(result[0].pecas).toHaveLength(2);
      expect(result[1].ordemId).toBe('os-2');
      expect(result[1].pecas).toHaveLength(1);
      expect(mockPrismaService.ordemServico.findMany).toHaveBeenCalledWith({
        where: { status: 'AWAITING_PARTS' },
        include: { osPecas: true },
      });
    });

    it('should return empty array when no ordens awaiting parts', async () => {
      mockPrismaService.ordemServico.findMany.mockResolvedValue([]);

      const result = await adapter.findAllAguardandoPecas();

      expect(result).toHaveLength(0);
    });

    it('should handle ordem servico with empty osPecas array', async () => {
      mockPrismaService.ordemServico.findMany.mockResolvedValue([
        {
          id: 'os-1',
          status: 'AWAITING_PARTS',
          osPecas: [],
        },
      ]);

      const result = await adapter.findAllAguardandoPecas();

      expect(result).toHaveLength(1);
      expect(result[0].pecas).toHaveLength(0);
    });
  });
});
