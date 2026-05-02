import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PecaInsumoRepository } from '../../../src/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

interface MockPrismaPeca {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
}

interface MockPrismaService {
  peca: MockPrismaPeca;
  osPeca: jest.Mock;
}

describe('PecaInsumoRepository', () => {
  let repository: PecaInsumoRepository;
  let mockPrismaService: MockPrismaService;

  const mockPecaData = {
    id: 'peca-1',
    nome: 'Óleo Lubrificante',
    descricao: 'Óleo 5W30 sintético',
    quantidade_estoque: 10,
    preco_unitario: 50.0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      peca: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      osPeca: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PecaInsumoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<PecaInsumoRepository>(PecaInsumoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return peca when found', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaData);

      const result = await repository.findOne('peca-1');

      expect(result.id).toBe('peca-1');
      expect(result.nome).toBe('Óleo Lubrificante');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(null);

      await expect(repository.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all pecas', async () => {
      mockPrismaService.peca.findMany.mockResolvedValue([mockPecaData]);
      mockPrismaService.peca.count.mockResolvedValue(1);

      const result = await repository.findAll();

      expect(result.data).toHaveLength(1);
    });

    it('should return empty array when no pecas', async () => {
      mockPrismaService.peca.findMany.mockResolvedValue([]);
      mockPrismaService.peca.count.mockResolvedValue(0);

      const result = await repository.findAll();

      expect(result.data).toHaveLength(0);
    });
  });

  describe('updateEstoque', () => {
    it('should update estoque successfully', async () => {
      const updatedPeca = { ...mockPecaData, quantidade_estoque: 15 };
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaData);
      mockPrismaService.peca.update.mockResolvedValue(updatedPeca);

      const result = await repository.updateEstoque('peca-1', 15);

      expect(result.quantidade_estoque).toBe(15);
    });

    it('should handle different quantities', async () => {
      const updatedPeca = { ...mockPecaData, quantidade_estoque: 5 };
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaData);
      mockPrismaService.peca.update.mockResolvedValue(updatedPeca);

      const result = await repository.updateEstoque('peca-1', 5);

      expect(result.quantidade_estoque).toBe(5);
    });
  });

  describe('create', () => {
    it('should create peca insumo', async () => {
      const createData = {
        nome: 'Filtro de Óleo',
        descricao: 'Filtro original',
        quantidade_estoque: 5,
        preco_unitario: 25.0,
      };
      mockPrismaService.peca.create.mockResolvedValue({
        ...mockPecaData,
        ...createData,
      });

      const result = await repository.create(createData);

      expect(result.nome).toBe('Filtro de Óleo');
      expect(result.quantidade_estoque).toBe(5);
    });
  });

  describe('remove', () => {
    it('should remove peca', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaData);
      mockPrismaService.peca.delete.mockResolvedValue(mockPecaData);

      await repository.remove('peca-1');

      expect(mockPrismaService.peca.delete).toHaveBeenCalledWith({
        where: { id: 'peca-1' },
      });
    });
  });
});
