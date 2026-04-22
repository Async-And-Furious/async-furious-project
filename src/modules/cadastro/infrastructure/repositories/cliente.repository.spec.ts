import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClienteRepository } from './cliente.repository';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Cliente } from '../../domain/entities/cliente.entity';

describe('ClienteRepository', () => {
  let repository: ClienteRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrismaService: any;

  const mockCliente: Cliente = {
    id: '123',
    nome: 'Test Client',
    email: 'test@test.com',
    telefone: '11999999999',
    documento: '12345678901',
    tipo_documento: 'CPF',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      customer: {
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
        ClienteRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<ClienteRepository>(ClienteRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a cliente', async () => {
      const createData = {
        nome: 'Test Client',
        email: 'test@test.com',
        telefone: '11999999999',
        documento: '12345678901',
        tipo_documento: 'CPF' as const,
      };
      mockPrismaService.customer.create.mockResolvedValue({
        ...createData,
        id: '123',
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      const result = await repository.create(createData);

      expect(result.nome).toBe('Test Client');
      expect(result.email).toBe('test@test.com');
      expect(mockPrismaService.customer.create).toHaveBeenCalledWith({ data: createData });
    });

    it('should create a cliente without telefone', async () => {
      const createData = {
        nome: 'Test Client',
        email: 'test@test.com',
        documento: '12345678901',
        tipo_documento: 'CPF' as const,
      };
      mockPrismaService.customer.create.mockResolvedValue({
        ...createData,
        telefone: null,
        id: '123',
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      const result = await repository.create(createData);

      expect(result.telefone).toBeNull();
      expect(mockPrismaService.customer.create).toHaveBeenCalledWith({ data: createData });
    });
  });

  describe('findAll', () => {
    it('should return clientes with pagination', async () => {
      const mockCustomers = [
        {
          id: '1',
          nome: 'Client 1',
          email: 'client1@test.com',
          telefone: null,
          documento: '1',
          tipo_documento: 'CPF',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          nome: 'Client 2',
          email: 'client2@test.com',
          telefone: null,
          documento: '2',
          tipo_documento: 'CPF',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers as never);
      mockPrismaService.customer.count.mockResolvedValue(2);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should apply search filter', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([] as never);
      mockPrismaService.customer.count.mockResolvedValue(0);

      await repository.findAll(1, 10, 'test');

      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { nome: { contains: 'test', mode: 'insensitive' as const } },
            { email: { contains: 'test', mode: 'insensitive' as const } },
            { documento: { contains: 'test' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should calculate correct pagination', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([] as never);
      mockPrismaService.customer.count.mockResolvedValue(15);

      const result = await repository.findAll(2, 5);

      expect(result.pagination.totalPages).toBe(3);
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5 })
      );
    });
  });

  describe('findOne', () => {
    it('should return a cliente by id', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...mockCliente,
        veiculos: [],
      } as never);

      const result = await repository.findOne('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.customer.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
        include: { veiculos: true },
      });
    });

    it('should throw NotFoundException when cliente not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(repository.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a cliente', async () => {
      const updateData = { nome: 'Updated Name' };
      const updatedCliente = { ...mockCliente, nome: 'Updated Name' };

      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...mockCliente,
        veiculos: [],
      } as never);
      mockPrismaService.customer.update.mockResolvedValue(updatedCliente as never);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('Updated Name');
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: updateData,
      });
    });

    it('should update multiple fields', async () => {
      const updateData = { nome: 'New Name', email: 'new@test.com' };
      const updatedCliente = { ...mockCliente, ...updateData };

      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...mockCliente,
        veiculos: [],
      } as never);
      mockPrismaService.customer.update.mockResolvedValue(updatedCliente as never);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('New Name');
      expect(result.email).toBe('new@test.com');
    });
  });

  describe('remove', () => {
    it('should delete a cliente', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...mockCliente,
        veiculos: [],
      } as never);
      mockPrismaService.customer.delete.mockResolvedValue(mockCliente as never);

      const result = await repository.remove('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.customer.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when trying to delete nonexistent cliente', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(repository.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
