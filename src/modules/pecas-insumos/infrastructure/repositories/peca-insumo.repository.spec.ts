import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PecaInsumoRepository } from './peca-insumo.repository';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { PecaInsumo } from '../../domain/entities/peca-insumo.entity';

interface MockPrismaPeca {
  create: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
}

interface MockPrismaService {
  peca: MockPrismaPeca;
}

describe('PecaInsumoRepository', () => {
  let repository: PecaInsumoRepository;

  let mockPrismaService: MockPrismaService;

  const mockPecaInsumo: PecaInsumo = {
    id: '123',
    nome: 'Filtro de Óleo',
    codigo: 'FO-001',
    descricao: 'Filtro de óleo para motor 1.0',
    preco: 29.9,
    quantidade_estoque: 10,
    quantidade_minima: 2,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      peca: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PecaInsumoRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<PecaInsumoRepository>(PecaInsumoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a peca insumo with all fields', async () => {
      const createData = {
        nome: 'Filtro de Óleo',
        codigo: 'FO-001',
        descricao: 'Filtro de óleo para motor 1.0',
        preco: 29.9,
        quantidade_estoque: 10,
        quantidade_minima: 2,
      };
      mockPrismaService.peca.create.mockResolvedValue({
        ...createData,
        id: '123',
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      const result = await repository.create(createData);

      expect(result.nome).toBe('Filtro de Óleo');
      expect(result.codigo).toBe('FO-001');
      expect(mockPrismaService.peca.create).toHaveBeenCalledWith({ data: createData });
    });

    it('should create a peca insumo without optional fields', async () => {
      const createData = { nome: 'Vela de Ignição', codigo: 'VI-001', preco: 15.5 };
      mockPrismaService.peca.create.mockResolvedValue({
        ...createData,
        descricao: null,
        quantidade_estoque: 0,
        quantidade_minima: 1,
        id: '456',
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      const result = await repository.create(createData);

      expect(result.descricao).toBeNull();
      expect(mockPrismaService.peca.create).toHaveBeenCalledWith({ data: createData });
    });
  });

  describe('findAll', () => {
    it('should return pecas insumo with pagination', async () => {
      mockPrismaService.peca.findMany.mockResolvedValue([mockPecaInsumo] as never);
      mockPrismaService.peca.count.mockResolvedValue(1);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should apply search filter on nome, codigo and descricao', async () => {
      mockPrismaService.peca.findMany.mockResolvedValue([] as never);
      mockPrismaService.peca.count.mockResolvedValue(0);

      await repository.findAll(1, 10, 'filtro');

      expect(mockPrismaService.peca.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { nome: { contains: 'filtro', mode: 'insensitive' as const } },
            { codigo: { contains: 'filtro', mode: 'insensitive' as const } },
            { descricao: { contains: 'filtro', mode: 'insensitive' as const } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should calculate correct totalPages', async () => {
      mockPrismaService.peca.findMany.mockResolvedValue([] as never);
      mockPrismaService.peca.count.mockResolvedValue(15);

      const result = await repository.findAll(2, 5);

      expect(result.pagination.totalPages).toBe(3);
      expect(mockPrismaService.peca.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5 })
      );
    });
  });

  describe('findOne', () => {
    it('should return a peca insumo by id', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaInsumo as never);

      const result = await repository.findOne('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.peca.findUnique).toHaveBeenCalledWith({ where: { id: '123' } });
    });

    it('should throw NotFoundException when peca insumo not found', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(null);

      await expect(repository.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a peca insumo', async () => {
      const updateData = { nome: 'Filtro de Ar' };
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaInsumo as never);
      mockPrismaService.peca.update.mockResolvedValue({
        ...mockPecaInsumo,
        nome: 'Filtro de Ar',
      } as never);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('Filtro de Ar');
      expect(mockPrismaService.peca.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: updateData,
      });
    });

    it('should throw NotFoundException when peca insumo not found', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(null);

      await expect(repository.update('nonexistent', { nome: 'X' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateEstoque', () => {
    it('should update stock quantity', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaInsumo as never);
      mockPrismaService.peca.update.mockResolvedValue({
        ...mockPecaInsumo,
        quantidade_estoque: 25,
      } as never);

      const result = await repository.updateEstoque('123', 25);

      expect(result.quantidade_estoque).toBe(25);
      expect(mockPrismaService.peca.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { quantidade_estoque: 25 },
      });
    });

    it('should throw NotFoundException when peca insumo not found', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(null);

      await expect(repository.updateEstoque('nonexistent', 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a peca insumo', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(mockPecaInsumo as never);
      mockPrismaService.peca.delete.mockResolvedValue(mockPecaInsumo as never);

      const result = await repository.remove('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.peca.delete).toHaveBeenCalledWith({ where: { id: '123' } });
    });

    it('should throw NotFoundException when trying to delete nonexistent peca insumo', async () => {
      mockPrismaService.peca.findUnique.mockResolvedValue(null);

      await expect(repository.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
