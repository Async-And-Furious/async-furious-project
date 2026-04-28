import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClienteRepository } from './cliente.repository';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

interface MockPrismaCliente {
  create: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
}

interface MockPrismaService {
  cliente: MockPrismaCliente;
}

describe('ClienteRepository', () => {
  let repository: ClienteRepository;

  let mockPrismaService: MockPrismaService;

  const validCpf = '52998224725';

  const mockOrmCliente = {
    id: '123',
    nome: 'Test Client',
    email: 'test@test.com',
    telefone: '11999999999',
    documento: validCpf,
    tipo_documento: 'CPF' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      cliente: {
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
        documento: validCpf,
        tipoDocumento: 'CPF' as const,
      };
      mockPrismaService.cliente.create.mockResolvedValue({
        ...mockOrmCliente,
        id: '123',
      });

      const result = await repository.create(createData);

      expect(result.nome).toBe('Test Client');
      expect(result.contato.email).toBe('test@test.com');
      expect(mockPrismaService.cliente.create).toHaveBeenCalled();
    });

    it('should create a cliente without telefone', async () => {
      const createData = {
        nome: 'Test Client',
        email: 'test@test.com',
        documento: validCpf,
        tipoDocumento: 'CPF' as const,
      };
      mockPrismaService.cliente.create.mockResolvedValue({
        ...mockOrmCliente,
        telefone: null,
        id: '123',
      });

      const result = await repository.create(createData);

      expect(result.contato.telefone).toBeNull();
      expect(mockPrismaService.cliente.create).toHaveBeenCalled();
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
          documento: validCpf,
          tipo_documento: 'CPF',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          nome: 'Client 2',
          email: 'client2@test.com',
          telefone: null,
          documento: validCpf,
          tipo_documento: 'CPF',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.cliente.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.cliente.count.mockResolvedValue(2);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should apply search filter', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(0);

      await repository.findAll(1, 10, 'test');

      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { nome: { contains: 'test', mode: 'insensitive' } },
            { email: { contains: 'test', mode: 'insensitive' } },
            { documento: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should calculate correct pagination', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(15);

      const result = await repository.findAll(2, 5);

      expect(result.pagination.totalPages).toBe(3);
      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5 })
      );
    });
  });

  describe('findById', () => {
    it('should return a cliente by id', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(mockOrmCliente);

      const result = await repository.findById('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.cliente.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
        include: { veiculos: true },
      });
    });

    it('should throw NotFoundException when cliente not found', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(null);

      await expect(repository.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a cliente', async () => {
      const updateData = { nome: 'Updated Name' };
      const updatedCliente = { ...mockOrmCliente, nome: 'Updated Name' };

      mockPrismaService.cliente.findUnique.mockResolvedValue(mockOrmCliente);
      mockPrismaService.cliente.update.mockResolvedValue(updatedCliente);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('Updated Name');
      expect(mockPrismaService.cliente.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: updateData,
      });
    });

    it('should update multiple fields', async () => {
      const updateData = { nome: 'New Name', email: 'new@test.com' };
      const updatedCliente = { ...mockOrmCliente, ...updateData };

      mockPrismaService.cliente.findUnique.mockResolvedValue(mockOrmCliente);
      mockPrismaService.cliente.update.mockResolvedValue(updatedCliente);

      const result = await repository.update('123', updateData);

      expect(result.nome).toBe('New Name');
      expect(result.contato.email).toBe('new@test.com');
    });
  });

  describe('remove', () => {
    it('should delete a cliente', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(mockOrmCliente);
      mockPrismaService.cliente.delete.mockResolvedValue(mockOrmCliente);

      const result = await repository.remove('123');

      expect(result.id).toBe('123');
      expect(mockPrismaService.cliente.delete).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when trying to delete nonexistent cliente', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(null);

      await expect(repository.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
