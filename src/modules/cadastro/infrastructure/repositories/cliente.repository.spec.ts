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

  const validCpf = '11144477735';
  const validCnpj = '11222333000181';

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
      });

      const result = await repository.create(createData);

      expect(result.contato.telefone).toBeNull();
    });

    it('should handle Cliente.criar with valid data', async () => {
      const createData = {
        nome: 'Client with all fields',
        email: 'full@test.com',
        telefone: '11988887777',
        documento: validCpf,
        tipoDocumento: 'CPF' as const,
      };
      mockPrismaService.cliente.create.mockResolvedValue({
        ...mockOrmCliente,
        ...createData,
      });

      const result = await repository.create(createData);

      expect(result.nome).toBe('Client with all fields');
    });

    it('should call prisma.cliente.create with correct data mapping', async () => {
      const createData = {
        nome: 'Test',
        email: 'test@test.com',
        telefone: '11999999999',
        documento: validCpf,
        tipoDocumento: 'CPF' as const,
      };
      mockPrismaService.cliente.create.mockResolvedValue({
        ...mockOrmCliente,
        ...createData,
      });

      await repository.create(createData);

      expect(mockPrismaService.cliente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nome: 'Test',
          email: 'test@test.com',
          telefone: '11999999999',
          documento: validCpf,
          tipo_documento: 'CPF',
        }),
      });
    });

    it('should handle create with CNPJ', async () => {
      const createData = {
        nome: 'Company',
        email: 'company@company.com',
        documento: validCnpj,
        tipoDocumento: 'CNPJ' as const,
      };
      mockPrismaService.cliente.create.mockResolvedValue({
        ...mockOrmCliente,
        documento: validCnpj,
        tipo_documento: 'CNPJ',
      });

      const result = await repository.create(createData);

      expect(result.cpfCnpj.tipo).toBe('CNPJ');
    });
  });

  describe('findAll', () => {
    it('should return clientes with pagination', async () => {
      const mockCustomers = [
        {
          id: '1',
          nome: 'Client 1',
          email: 'a@test.com',
          telefone: '11111111111',
          documento: validCpf,
          tipo_documento: 'CPF',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          nome: 'Client 2',
          email: 'b@test.com',
          telefone: '22222222222',
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
    });

    it('should return empty array when no clientes', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(0);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
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

    it('should call with empty where when search is undefined', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([mockOrmCliente]);
      mockPrismaService.cliente.count.mockResolvedValue(1);

      await repository.findAll(1, 10);

      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    // ─── BRANCH: default parameters (page e limit não fornecidos) ───────────
    it('should use default page=1 and limit=10 when called without arguments', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([mockOrmCliente]);
      mockPrismaService.cliente.count.mockResolvedValue(1);

      // Exercita os default parameters: `page = 1` e `limit = 10`
      const result = await repository.findAll();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 })
      );
    });

    // ─── BRANCH: search como string vazia → buildSearchWhere retorna falsy ──
    it('should treat empty string search as no filter (fallback to empty where)', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(0);

      await repository.findAll(1, 10, '');

      // `buildSearchWhere` retorna null/undefined para string vazia,
      // forçando o branch `|| {}` do repositório
      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    // ─── BRANCH: apenas page fornecido (limit usa default) ──────────────────
    it('should use default limit=10 when only page is provided', async () => {
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(0);

      const result = await repository.findAll(2);

      expect(result.pagination.limit).toBe(10);
      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
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

    // ─── BRANCH: NotFoundException com mensagem correta ─────────────────────
    it('should throw NotFoundException with correct message', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(null);

      await expect(repository.findById('abc-123')).rejects.toThrow(
        'Cliente com ID abc-123 nao encontrado'
      );
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

    it('should throw NotFoundException when updating nonexistent cliente', async () => {
      mockPrismaService.cliente.findUnique.mockResolvedValue(null);

      await expect(repository.update('nonexistent', { nome: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });

    // ─── BRANCH: update apenas com telefone (nome e email undefined) ────────
    it('should update only telefone when nome and email are not provided', async () => {
      const updateData = { telefone: '11988880000' };
      const updatedCliente = { ...mockOrmCliente, telefone: '11988880000' };

      mockPrismaService.cliente.findUnique.mockResolvedValue(mockOrmCliente);
      mockPrismaService.cliente.update.mockResolvedValue(updatedCliente);

      const result = await repository.update('123', updateData);

      expect(mockPrismaService.cliente.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: expect.objectContaining({ telefone: '11988880000' }),
      });
      expect(result).toBeDefined();
    });

    // ─── BRANCH: update sem nenhum campo (objeto vazio) ─────────────────────
    it('should handle update with no fields (all undefined)', async () => {
      const updateData = {};
      const updatedCliente = { ...mockOrmCliente };

      mockPrismaService.cliente.findUnique.mockResolvedValue(mockOrmCliente);
      mockPrismaService.cliente.update.mockResolvedValue(updatedCliente);

      const result = await repository.update('123', updateData);

      expect(mockPrismaService.cliente.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: expect.objectContaining({}),
      });
      expect(result).toBeDefined();
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
