import { Test, TestingModule } from '@nestjs/testing';
import { ClienteController } from './cliente.controller';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from '../../application/use-cases';
import { CreateClienteDto, UpdateClienteDto, ListQueryDto } from '../dto/cliente.dto';
import { Cliente } from '../../domain/entities/cliente.entity';
import { AuthUser } from '../../../../auth/types/auth.types';

describe('ClienteController', () => {
  let controller: ClienteController;
  let mockCreateUseCase: jest.Mocked<CreateClienteUseCase>;
  let mockListUseCase: jest.Mocked<ListClientesUseCase>;
  let mockGetUseCase: jest.Mocked<GetClienteUseCase>;
  let mockUpdateUseCase: jest.Mocked<UpdateClienteUseCase>;
  let mockDeleteUseCase: jest.Mocked<DeleteClienteUseCase>;

  const mockAuthUser: AuthUser = {
    id: 'user-123',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'admin',
  };

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
    mockCreateUseCase = { execute: jest.fn() } as unknown as jest.Mocked<CreateClienteUseCase>;
    mockListUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ListClientesUseCase>;
    mockGetUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetClienteUseCase>;
    mockUpdateUseCase = { execute: jest.fn() } as unknown as jest.Mocked<UpdateClienteUseCase>;
    mockDeleteUseCase = { execute: jest.fn() } as unknown as jest.Mocked<DeleteClienteUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClienteController],
      providers: [
        { provide: CreateClienteUseCase, useValue: mockCreateUseCase },
        { provide: ListClientesUseCase, useValue: mockListUseCase },
        { provide: GetClienteUseCase, useValue: mockGetUseCase },
        { provide: UpdateClienteUseCase, useValue: mockUpdateUseCase },
        { provide: DeleteClienteUseCase, useValue: mockDeleteUseCase },
      ],
    }).compile();

    controller = module.get<ClienteController>(ClienteController);
  });

  describe('create', () => {
    it('should create a cliente', async () => {
      const createDto: CreateClienteDto = {
        nome: 'Test Client',
        email: 'test@test.com',
        telefone: '11999999999',
        documento: '12345678901',
        tipo_documento: 'CPF',
      };
      mockCreateUseCase.execute.mockResolvedValue(mockCliente);

      const result = await controller.create(createDto);

      expect(result).toBe(mockCliente);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(createDto);
    });

    it('should create a cliente without telefone', async () => {
      const createDto: CreateClienteDto = {
        nome: 'Test Client',
        email: 'test@test.com',
        documento: '12345678901',
        tipo_documento: 'CPF',
      };
      mockCreateUseCase.execute.mockResolvedValue({ ...mockCliente, telefone: null });

      const result = await controller.create(createDto);

      expect(result.telefone).toBeNull();
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should list clientes with default pagination', async () => {
      const mockResult = {
        data: [mockCliente],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.findAll({} as ListQueryDto, mockAuthUser);

      expect(result).toBe(mockResult);
      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should list clientes with custom pagination', async () => {
      const mockResult = {
        data: [mockCliente],
        pagination: { page: 2, limit: 5, total: 10, totalPages: 2 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.findAll(
        { page: 2, limit: 5 } as unknown as ListQueryDto,
        mockAuthUser
      );

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(mockListUseCase.execute).toHaveBeenCalledWith(2, 5, undefined);
    });

    it('should list clientes with search', async () => {
      const mockResult = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      await controller.findAll({ search: 'test' } as unknown as ListQueryDto, mockAuthUser);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, 'test');
    });
  });

  describe('findOne', () => {
    it('should get a cliente by id', async () => {
      mockGetUseCase.execute.mockResolvedValue(mockCliente);

      const result = await controller.findOne('123', mockAuthUser);

      expect(result).toBe(mockCliente);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith('123');
    });
  });

  describe('update', () => {
    it('should update a cliente', async () => {
      const updateDto: UpdateClienteDto = { nome: 'Updated Name' };
      mockUpdateUseCase.execute.mockResolvedValue({ ...mockCliente, nome: 'Updated Name' });

      const result = await controller.update('123', updateDto);

      expect(result.nome).toBe('Updated Name');
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith('123', updateDto);
    });

    it('should update multiple fields', async () => {
      const updateDto: UpdateClienteDto = {
        nome: 'New Name',
        email: 'new@test.com',
        telefone: '11988887777',
      };
      mockUpdateUseCase.execute.mockResolvedValue({ ...mockCliente, ...updateDto });

      const result = await controller.update('123', updateDto);

      expect(result.nome).toBe('New Name');
      expect(result.email).toBe('new@test.com');
      expect(result.telefone).toBe('11988887777');
    });
  });

  describe('remove', () => {
    it('should delete a cliente', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(mockCliente);

      const result = await controller.remove('123');

      expect(result).toBe(mockCliente);
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith('123');
    });
  });
});
