import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdemServicoRepository } from '@/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';

describe('OrdemServicoRepository', () => {
  let repository: OrdemServicoRepository;
  let prismaService: PrismaService;

  const mockOrdemServico = {
    id: 'os-123',
    id_veiculo: 'veiculo-123',
    id_cliente: 'cliente-123',
    descricao: 'Troca de óleo',
    status: 'RECEIVED',
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
    veiculo: {
      id: 'veiculo-123',
      placa: 'ABC-1234',
      marca: 'Toyota',
      modelo: 'Corolla',
      ano: 2020,
    },
    cliente: {
      id: 'cliente-123',
      nome: 'João Silva',
      documento: '12345678901',
      tipo_documento: 'CPF',
    },
    orcamento: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      ordemServico: {
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
        OrdemServicoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<OrdemServicoRepository>(OrdemServicoRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('deve criar uma nova ordem de serviço', async () => {
      const createData = {
        veiculoId: 'veiculo-123',
        clienteId: 'cliente-123',
        descricao: 'Troca de óleo',
      };

      (prismaService.ordemServico.create as jest.Mock).mockResolvedValue(mockOrdemServico);

      const result = await repository.create(createData);

      expect(prismaService.ordemServico.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          id_veiculo: createData.veiculoId,
          id_cliente: createData.clienteId,
          descricao: createData.descricao,
          status: 'RECEIVED',
        },
      });
      expect(result).toEqual(mockOrdemServico);
    });

    it('deve criar ordem de serviço sem descrição', async () => {
      const createData = {
        veiculoId: 'veiculo-123',
        clienteId: 'cliente-123',
      };

      const ordemSemDescricao = { ...mockOrdemServico, descricao: null };
      (prismaService.ordemServico.create as jest.Mock).mockResolvedValue(ordemSemDescricao);

      const result = await repository.create(createData);

      expect(prismaService.ordemServico.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          id_veiculo: createData.veiculoId,
          id_cliente: createData.clienteId,
          descricao: undefined,
          status: 'RECEIVED',
        },
      });
      expect(result).toEqual(ordemSemDescricao);
    });
  });

  describe('findAll', () => {
    it('deve retornar lista paginada de ordens de serviço', async () => {
      const mockOrdens = [mockOrdemServico];
      const mockTotal = 1;

      (prismaService.ordemServico.findMany as jest.Mock).mockResolvedValue(mockOrdens);
      (prismaService.ordemServico.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await repository.findAll(1, 10);

      expect(prismaService.ordemServico.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          veiculo: true,
          cliente: true,
          orcamento: true,
        },
      });
      expect(prismaService.ordemServico.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: mockOrdens,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('deve retornar lista filtrada por busca', async () => {
      const mockOrdens = [mockOrdemServico];
      const mockTotal = 1;
      const searchTerm = 'óleo';

      (prismaService.ordemServico.findMany as jest.Mock).mockResolvedValue(mockOrdens);
      (prismaService.ordemServico.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await repository.findAll(1, 10, searchTerm);

      expect(prismaService.ordemServico.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ descricao: { contains: searchTerm, mode: 'insensitive' } }],
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          veiculo: true,
          cliente: true,
          orcamento: true,
        },
      });
      expect(result.data).toEqual(mockOrdens);
    });

    it('deve calcular paginação corretamente', async () => {
      const mockOrdens = [mockOrdemServico];
      const mockTotal = 25;

      (prismaService.ordemServico.findMany as jest.Mock).mockResolvedValue(mockOrdens);
      (prismaService.ordemServico.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await repository.findAll(3, 5);

      expect(prismaService.ordemServico.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          veiculo: true,
          cliente: true,
          orcamento: true,
        },
      });
      expect(result.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 25,
        totalPages: 5,
      });
    });
  });

  describe('findOne', () => {
    it('deve retornar uma ordem de serviço por ID', async () => {
      const id = 'os-123';
      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(mockOrdemServico);

      const result = await repository.findOne(id);

      expect(prismaService.ordemServico.findUnique).toHaveBeenCalledWith({
        where: { id },
        include: { veiculo: true, cliente: true, orcamento: true },
      });
      expect(result).toEqual(mockOrdemServico);
    });

    it('deve lançar NotFoundException quando ordem não encontrada', async () => {
      const id = 'os-inexistente';
      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repository.findOne(id)).rejects.toThrow(
        new NotFoundException(`Ordem de Serviço com ID ${id} não encontrada`)
      );
    });
  });

  describe('update', () => {
    it('deve atualizar uma ordem de serviço', async () => {
      const id = 'os-123';
      const updateData = {
        status: 'IN_PROGRESS' as const,
        descricao: 'Troca de óleo e filtro',
        iniciada_em: new Date('2024-01-16'),
      };

      const updatedOrdem = { ...mockOrdemServico, ...updateData };

      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(mockOrdemServico);
      (prismaService.ordemServico.update as jest.Mock).mockResolvedValue(updatedOrdem);

      const result = await repository.update(id, updateData);

      expect(prismaService.ordemServico.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          status: updateData.status,
          descricao: updateData.descricao,
          iniciada_em: updateData.iniciada_em,
        },
      });
      expect(result).toEqual(updatedOrdem);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const id = 'os-123';
      const updateData = { status: 'FINISHED' as const };

      const updatedOrdem = { ...mockOrdemServico, status: 'FINISHED' };

      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(mockOrdemServico);
      (prismaService.ordemServico.update as jest.Mock).mockResolvedValue(updatedOrdem);

      const result = await repository.update(id, updateData);

      expect(prismaService.ordemServico.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          status: updateData.status,
        },
      });
      expect(result).toEqual(updatedOrdem);
    });

    it('deve permitir definir campos como undefined', async () => {
      const id = 'os-123';
      const updateData = {
        descricao: undefined,
        finalizada_em: undefined,
      };

      const updatedOrdem = { ...mockOrdemServico, ...updateData };

      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(mockOrdemServico);
      (prismaService.ordemServico.update as jest.Mock).mockResolvedValue(updatedOrdem);

      const result = await repository.update(id, updateData);

      expect(prismaService.ordemServico.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          descricao: undefined,
          finalizada_em: undefined,
        },
      });
      expect(result).toEqual(updatedOrdem);
    });

    it('deve lançar NotFoundException quando ordem não encontrada para atualização', async () => {
      const id = 'os-inexistente';
      const updateData = { status: 'FINISHED' as const };

      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repository.update(id, updateData)).rejects.toThrow(
        new NotFoundException(`Ordem de Serviço com ID ${id} não encontrada`)
      );
    });
  });

  describe('remove', () => {
    it('deve remover uma ordem de serviço', async () => {
      const id = 'os-123';

      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(mockOrdemServico);
      (prismaService.ordemServico.delete as jest.Mock).mockResolvedValue(mockOrdemServico);

      const result = await repository.remove(id);

      expect(prismaService.ordemServico.delete).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toEqual(mockOrdemServico);
    });

    it('deve lançar NotFoundException quando ordem não encontrada para remoção', async () => {
      const id = 'os-inexistente';

      (prismaService.ordemServico.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repository.remove(id)).rejects.toThrow(
        new NotFoundException(`Ordem de Serviço com ID ${id} não encontrada`)
      );
    });
  });

  describe('calcularTempoMedioExecucao', () => {
    it('deve calcular a média corretamente com múltiplas ordens', async () => {
      const inicio = new Date('2024-01-01T08:00:00Z');
      const fim1 = new Date('2024-01-01T10:00:00Z'); // 120 min
      const fim2 = new Date('2024-01-01T09:00:00Z'); // 60 min

      (prismaService.ordemServico.findMany as jest.Mock).mockResolvedValue([
        { iniciada_em: inicio, finalizada_em: fim1 },
        { iniciada_em: inicio, finalizada_em: fim2 },
      ]);

      const result = await repository.calcularTempoMedioExecucao();

      expect(prismaService.ordemServico.findMany).toHaveBeenCalledWith({
        where: {
          status: 'DELIVERED',
          iniciada_em: { not: null },
          finalizada_em: { not: null },
        },
        select: { iniciada_em: true, finalizada_em: true },
      });
      expect(result).toEqual({ totalMinutos: 180, total: 2 });
    });

    it('deve retornar zero quando não há ordens entregues', async () => {
      (prismaService.ordemServico.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.calcularTempoMedioExecucao();

      expect(result).toEqual({ totalMinutos: 0, total: 0 });
    });
  });
});
