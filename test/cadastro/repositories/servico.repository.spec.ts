import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicoRepository } from '../../../src/modules/cadastro/infrastructure/repositories/servico.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

interface MockPrismaServico {
  create: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
}

interface MockPrismaService {
  servico: MockPrismaServico;
}

describe('ServicoRepository', () => {
  let repository: ServicoRepository;
  let mockPrismaService: MockPrismaService;

  const mockOrmServico = {
    id: '123',
    nome: 'Troca de Óleo',
    descricao: 'Troca completa de óleo do motor',
    preco: 150.0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      servico: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<ServicoRepository>(ServicoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a servico', async () => {
      const createData = {
        nome: 'Troca de Óleo',
        descricao: 'Troca completa',
        preco: 150,
      };
      mockPrismaService.servico.create.mockResolvedValue({
        ...mockOrmServico,
        ...createData,
      });

      const result = await repository.create(createData);

      expect(result.nome).toBe('Troca de Óleo');
      expect(result.preco).toBe(150);
      expect(mockPrismaService.servico.create).toHaveBeenCalledWith({ data: createData });
    });

    it('should create a servico without descricao', async () => {
      const createData = { nome: 'Alinhamento', preco: 100 };
      mockPrismaService.servico.create.mockResolvedValue({
        ...mockOrmServico,
        ...createData,
        descricao: null,
      });

      const result = await repository.create(createData);

      expect(result.descricao).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return servicos with pagination', async () => {
      const mockServicos = [mockOrmServico];
      mockPrismaService.servico.findMany.mockResolvedValue(mockServicos);
      mockPrismaService.servico.count.mockResolvedValue(1);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should return empty array when no servicos', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([]);
      mockPrismaService.servico.count.mockResolvedValue(0);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should apply search filter', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([]);
      mockPrismaService.servico.count.mockResolvedValue(0);

      await repository.findAll(1, 10, 'Óleo');

      expect(mockPrismaService.servico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should calculate correct pagination for multiple pages', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([]);
      mockPrismaService.servico.count.mockResolvedValue(25);

      const result = await repository.findAll(3, 5);

      expect(result.pagination.totalPages).toBe(5);
      expect(mockPrismaService.servico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10 })
      );
    });
  });

  describe('findOne', () => {
    it('should return a servico by id', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(mockOrmServico);

      const result = await repository.findOne('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.servico.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when servico not found', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(null);

      await expect(repository.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a servico', async () => {
      const updateData = { nome: 'Troca de Filtro' };
      const updatedServico = { ...mockOrmServico, ...updateData };

      mockPrismaService.servico.findUnique.mockResolvedValue(mockOrmServico);
      mockPrismaService.servico.update.mockResolvedValue(updatedServico);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('Troca de Filtro');
      expect(mockPrismaService.servico.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: updateData,
      });
    });

    it('should update multiple fields', async () => {
      const updateData = { nome: 'Freio', preco: 200 };
      const updatedServico = { ...mockOrmServico, ...updateData };

      mockPrismaService.servico.findUnique.mockResolvedValue(mockOrmServico);
      mockPrismaService.servico.update.mockResolvedValue(updatedServico);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('Freio');
      expect(result.preco).toBe(200);
    });
  });

  describe('remove', () => {
    it('should delete a servico', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(mockOrmServico);
      mockPrismaService.servico.delete.mockResolvedValue(mockOrmServico);

      const result = await repository.remove('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.servico.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when trying to delete nonexistent servico', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(null);

      await expect(repository.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
