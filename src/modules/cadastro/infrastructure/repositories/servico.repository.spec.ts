import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicoRepository } from './servico.repository';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

describe('ServicoRepository', () => {
  let repository: ServicoRepository;
  let mockPrismaService: any;

  const mockServico = {
    id: 'serv-1',
    nome: 'Troca de Óleo',
    descricao: 'Troca completa',
    preco: 150,
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
      providers: [ServicoRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<ServicoRepository>(ServicoRepository);
  });

  describe('create', () => {
    it('should create a servico', async () => {
      mockPrismaService.servico.create.mockResolvedValue(mockServico);
      const result = await repository.create({ nome: 'Troca de Óleo', preco: 150 });
      expect(result.nome).toBe('Troca de Óleo');
    });

    it('should create with optional descricao', async () => {
      const servicoWithDesc = { ...mockServico, descricao: 'Desc' };
      mockPrismaService.servico.create.mockResolvedValue(servicoWithDesc);
      const result = await repository.create({ nome: 'Test', descricao: 'Desc', preco: 100 });
      expect(result.descricao).toBe('Desc');
    });
  });

  describe('findAll', () => {
    it('should return paginated servicos', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([mockServico]);
      mockPrismaService.servico.count.mockResolvedValue(1);
      const result = await repository.findAll(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should handle empty result', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([]);
      mockPrismaService.servico.count.mockResolvedValue(0);
      const result = await repository.findAll(1, 10);
      expect(result.data).toHaveLength(0);
    });

    it('should apply search filter', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([]);
      mockPrismaService.servico.count.mockResolvedValue(0);
      await repository.findAll(1, 10, 'óleo');
      expect(mockPrismaService.servico.findMany).toHaveBeenCalled();
    });

    it('should calculate pagination correctly', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([]);
      mockPrismaService.servico.count.mockResolvedValue(25);
      const result = await repository.findAll(3, 5);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should use default parameters when not provided', async () => {
      mockPrismaService.servico.findMany.mockResolvedValue([mockServico]);
      mockPrismaService.servico.count.mockResolvedValue(1);
      const result = await repository.findAll();
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return servico by id', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(mockServico);
      const result = await repository.findOne('serv-1');
      expect(result.id).toBe('serv-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(null);
      await expect(repository.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update servico', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(mockServico);
      mockPrismaService.servico.update.mockResolvedValue({ ...mockServico, nome: 'Updated' });
      const result = await repository.update('serv-1', { nome: 'Updated' });
      expect(result.nome).toBe('Updated');
    });

    it('should throw NotFoundException when updating nonexistent', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(null);
      await expect(repository.update('invalid', { nome: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should delete servico', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(mockServico);
      mockPrismaService.servico.delete.mockResolvedValue(mockServico);
      const result = await repository.remove('serv-1');
      expect(result.id).toBe('serv-1');
    });

    it('should throw NotFoundException when deleting nonexistent', async () => {
      mockPrismaService.servico.findUnique.mockResolvedValue(null);
      await expect(repository.remove('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
