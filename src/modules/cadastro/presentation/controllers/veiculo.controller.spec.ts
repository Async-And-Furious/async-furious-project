import { Test, TestingModule } from '@nestjs/testing';
import { VeiculoController } from './veiculo.controller';
import {
  CreateVeiculoUseCase,
  ListVeiculosUseCase,
  GetVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
} from '../../application/use-cases/veiculo.use-cases';
import { CreateVeiculoDto, UpdateVeiculoDto, ListQueryDto } from '../dto/veiculo.dto';
import { VeiculoResponseDto, VeiculoListResponseDto } from '../dto/veiculo.response.dto';
import { AuthUser } from '../../../../auth/types/auth.types';

interface MockUseCase {
  execute: jest.Mock;
}

describe('VeiculoController', () => {
  let controller: VeiculoController;

  let mockCreateUseCase: MockUseCase;

  let mockListUseCase: MockUseCase;

  let mockGetUseCase: MockUseCase;

  let mockUpdateUseCase: MockUseCase;

  let mockDeleteUseCase: MockUseCase;

  const mockAuthUser: AuthUser = {
    id: 'user-123',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'admin',
  };

  const mockVeiculoResponse: VeiculoResponseDto = {
    id: 'veiculo-123',
    placa: 'ABC1234',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2020,
    cor: 'Preto',
    clienteId: 'cliente-123',
  };

  beforeEach(async () => {
    mockCreateUseCase = {
      execute: jest.fn(),
    };
    mockListUseCase = {
      execute: jest.fn(),
    };
    mockGetUseCase = {
      execute: jest.fn(),
    };
    mockUpdateUseCase = {
      execute: jest.fn(),
    };
    mockDeleteUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VeiculoController],
      providers: [
        { provide: CreateVeiculoUseCase, useValue: mockCreateUseCase },
        { provide: ListVeiculosUseCase, useValue: mockListUseCase },
        { provide: GetVeiculoUseCase, useValue: mockGetUseCase },
        { provide: UpdateVeiculoUseCase, useValue: mockUpdateUseCase },
        { provide: DeleteVeiculoUseCase, useValue: mockDeleteUseCase },
      ],
    }).compile();

    controller = module.get<VeiculoController>(VeiculoController);
  });

  describe('create', () => {
    it('should create a veiculo', async () => {
      const createDto: CreateVeiculoDto = {
        placa: 'ABC1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Preto',
        clienteId: 'cliente-123',
      };
      mockCreateUseCase.execute.mockResolvedValue(mockVeiculoResponse);

      const result = await controller.create(createDto);

      expect(result).toBe(mockVeiculoResponse);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return list of veiculos', async () => {
      const mockListResponse: VeiculoListResponseDto = {
        data: [mockVeiculoResponse],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockListUseCase.execute.mockResolvedValue(mockListResponse);

      const query: ListQueryDto = { page: 1, limit: 10 };
      const result = await controller.findAll(query, mockAuthUser);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should pass search parameter', async () => {
      const mockListResponse: VeiculoListResponseDto = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockListUseCase.execute.mockResolvedValue(mockListResponse);

      const query: ListQueryDto = { page: 1, limit: 10, search: 'Toyota' };
      await controller.findAll(query, mockAuthUser);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, 'Toyota');
    });
  });

  describe('findOne', () => {
    it('should return a veiculo by id', async () => {
      mockGetUseCase.execute.mockResolvedValue(mockVeiculoResponse);

      const result = await controller.findOne('veiculo-123', mockAuthUser);

      expect(result).toBe(mockVeiculoResponse);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith('veiculo-123');
    });
  });

  describe('update', () => {
    it('should update a veiculo', async () => {
      const updateDto: UpdateVeiculoDto = { marca: 'Honda' };
      const updatedVeiculo = { ...mockVeiculoResponse, marca: 'Honda' };
      mockUpdateUseCase.execute.mockResolvedValue(updatedVeiculo);

      const result = await controller.update('veiculo-123', updateDto);

      expect(result.marca).toBe('Honda');
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith('veiculo-123', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a veiculo', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(mockVeiculoResponse);

      const result = await controller.remove('veiculo-123');

      expect(result).toBe(mockVeiculoResponse);
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith('veiculo-123');
    });
  });
});
