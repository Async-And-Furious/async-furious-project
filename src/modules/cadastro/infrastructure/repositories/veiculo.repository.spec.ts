import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VeiculoRepository } from './veiculo.repository';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

describe('VeiculoRepository', () => {
  let repository: VeiculoRepository;

  let mockPrismaService: any;

  const validPlaca = 'ABC1234';

  const mockOrmVeiculo = {
    id: '123',
    placa: validPlaca,
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Preto',
    clienteId: 'cliente-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      veiculo: {
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
        VeiculoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<VeiculoRepository>(VeiculoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a veiculo', async () => {
      const createData = {
        placa: validPlaca,
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Preto',
        clienteId: 'cliente-123',
      };
      mockPrismaService.veiculo.create.mockResolvedValue({
        ...mockOrmVeiculo,
        id: '123',
      });

      const result = await repository.create(createData);

      expect(result.marca).toBe('Toyota');
      expect(result.modelo).toBe('Corolla');
      expect(mockPrismaService.veiculo.create).toHaveBeenCalled();
    });

    it('should create a veiculo without cor', async () => {
      const createData = {
        placa: validPlaca,
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cliente-123',
      };
      mockPrismaService.veiculo.create.mockResolvedValue({
        ...mockOrmVeiculo,
        cor: null,
        id: '123',
      });

      const result = await repository.create(createData);

      expect(result.cor).toBeNull();
      expect(mockPrismaService.veiculo.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return veiculos with pagination', async () => {
      const mockVeiculos = [
        {
          id: '1',
          placa: validPlaca,
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2020,
          cor: 'Preto',
          clienteId: 'cliente-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          placa: 'DEF5678',
          marca: 'Honda',
          modelo: 'Civic',
          ano: 2021,
          cor: 'Branco',
          clienteId: 'cliente-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.veiculo.findMany.mockResolvedValue(mockVeiculos);
      mockPrismaService.veiculo.count.mockResolvedValue(2);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should apply search filter', async () => {
      mockPrismaService.veiculo.findMany.mockResolvedValue([]);
      mockPrismaService.veiculo.count.mockResolvedValue(0);

      await repository.findAll(1, 10, 'Toyota');

      expect(mockPrismaService.veiculo.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { placa: { contains: 'Toyota', mode: 'insensitive' as const } },
            { marca: { contains: 'Toyota', mode: 'insensitive' as const } },
            { modelo: { contains: 'Toyota', mode: 'insensitive' as const } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should calculate correct pagination', async () => {
      mockPrismaService.veiculo.findMany.mockResolvedValue([]);
      mockPrismaService.veiculo.count.mockResolvedValue(15);

      const result = await repository.findAll(2, 5);

      expect(result.pagination.totalPages).toBe(3);
      expect(mockPrismaService.veiculo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5 })
      );
    });
  });

  describe('findById', () => {
    it('should return a veiculo by id', async () => {
      mockPrismaService.veiculo.findUnique.mockResolvedValue(mockOrmVeiculo);

      const result = await repository.findById('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.veiculo.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when veiculo not found', async () => {
      mockPrismaService.veiculo.findUnique.mockResolvedValue(null);

      await expect(repository.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPlaca', () => {
    it('should return a veiculo by placa', async () => {
      mockPrismaService.veiculo.findUnique.mockResolvedValue(mockOrmVeiculo);

      const result = await repository.findByPlaca(validPlaca);

      expect(result?.placa.valor).toBe(validPlaca);
    });

    it('should return null when veiculo not found', async () => {
      mockPrismaService.veiculo.findUnique.mockResolvedValue(null);

      const result = await repository.findByPlaca('XYZ9999');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a veiculo', async () => {
      const updateData = { marca: 'Honda' };
      const updatedVeiculo = { ...mockOrmVeiculo, marca: 'Honda' };

      mockPrismaService.veiculo.findUnique.mockResolvedValue(mockOrmVeiculo);
      mockPrismaService.veiculo.update.mockResolvedValue(updatedVeiculo);

      const result = await repository.update('123', updateData);

      expect(result.marca).toBe('Honda');
      expect(mockPrismaService.veiculo.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: updateData,
      });
    });

    it('should update multiple fields', async () => {
      const updateData = { marca: 'Ford', modelo: 'Focus' };
      const updatedVeiculo = { ...mockOrmVeiculo, ...updateData };

      mockPrismaService.veiculo.findUnique.mockResolvedValue(mockOrmVeiculo);
      mockPrismaService.veiculo.update.mockResolvedValue(updatedVeiculo);

      const result = await repository.update('123', updateData);

      expect(result.marca).toBe('Ford');
      expect(result.modelo).toBe('Focus');
    });
  });

  describe('remove', () => {
    it('should delete a veiculo', async () => {
      mockPrismaService.veiculo.findUnique.mockResolvedValue(mockOrmVeiculo);
      mockPrismaService.veiculo.delete.mockResolvedValue(mockOrmVeiculo);

      const result = await repository.remove('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.veiculo.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when trying to delete nonexistent veiculo', async () => {
      mockPrismaService.veiculo.findUnique.mockResolvedValue(null);

      await expect(repository.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
