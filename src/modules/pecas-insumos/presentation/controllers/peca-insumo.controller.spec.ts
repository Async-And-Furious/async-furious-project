import { Test, TestingModule } from '@nestjs/testing';
import { PecaInsumoController } from './peca-insumo.controller';
import {
  CreatePecaInsumoUseCase,
  ListPecasInsumoUseCase,
  GetPecaInsumoUseCase,
  UpdatePecaInsumoUseCase,
  UpdateEstoquePecaInsumoUseCase,
  DeletePecaInsumoUseCase,
} from '../../application/use-cases/peca-insumo.use-cases';
import {
  CreatePecaInsumoDto,
  UpdatePecaInsumoDto,
  UpdateEstoquePecaInsumoDto,
  ListQueryDto,
} from '../dto/peca-insumo.dto';
import { PecaInsumo } from '../../domain/entities/peca-insumo.entity';
import { AuthUser } from '../../../../auth/types/auth.types';

describe('PecaInsumoController', () => {
  let controller: PecaInsumoController;
  let mockCreateUseCase: jest.Mocked<CreatePecaInsumoUseCase>;
  let mockListUseCase: jest.Mocked<ListPecasInsumoUseCase>;
  let mockGetUseCase: jest.Mocked<GetPecaInsumoUseCase>;
  let mockUpdateUseCase: jest.Mocked<UpdatePecaInsumoUseCase>;
  let mockUpdateEstoqueUseCase: jest.Mocked<UpdateEstoquePecaInsumoUseCase>;
  let mockDeleteUseCase: jest.Mocked<DeletePecaInsumoUseCase>;

  const mockAuthUser: AuthUser = {
    id: 'user-123',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'admin',
  };

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
    mockCreateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreatePecaInsumoUseCase>;
    mockListUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ListPecasInsumoUseCase>;
    mockGetUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetPecaInsumoUseCase>;
    mockUpdateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdatePecaInsumoUseCase>;
    mockUpdateEstoqueUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateEstoquePecaInsumoUseCase>;
    mockDeleteUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeletePecaInsumoUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PecaInsumoController],
      providers: [
        { provide: CreatePecaInsumoUseCase, useValue: mockCreateUseCase },
        { provide: ListPecasInsumoUseCase, useValue: mockListUseCase },
        { provide: GetPecaInsumoUseCase, useValue: mockGetUseCase },
        { provide: UpdatePecaInsumoUseCase, useValue: mockUpdateUseCase },
        { provide: UpdateEstoquePecaInsumoUseCase, useValue: mockUpdateEstoqueUseCase },
        { provide: DeletePecaInsumoUseCase, useValue: mockDeleteUseCase },
      ],
    }).compile();

    controller = module.get<PecaInsumoController>(PecaInsumoController);
  });

  describe('create', () => {
    it('should create a peca insumo', async () => {
      const dto: CreatePecaInsumoDto = {
        nome: 'Filtro de Óleo',
        codigo: 'FO-001',
        preco: 29.9,
      };
      mockCreateUseCase.execute.mockResolvedValue(mockPecaInsumo);

      const result = await controller.create(dto);

      expect(result).toBe(mockPecaInsumo);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(dto);
    });

    it('should create a peca insumo without optional fields', async () => {
      const dto: CreatePecaInsumoDto = { nome: 'Vela', codigo: 'VI-001', preco: 15.5 };
      mockCreateUseCase.execute.mockResolvedValue({ ...mockPecaInsumo, descricao: null });

      const result = await controller.create(dto);

      expect(result.descricao).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should list pecas insumo with default pagination', async () => {
      const mockResult = {
        data: [mockPecaInsumo],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.findAll({} as ListQueryDto, mockAuthUser);

      expect(result).toBe(mockResult);
      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should list pecas insumo with custom pagination and search', async () => {
      const mockResult = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      await controller.findAll(
        { page: 2, limit: 5, search: 'filtro' } as unknown as ListQueryDto,
        mockAuthUser,
      );

      expect(mockListUseCase.execute).toHaveBeenCalledWith(2, 5, 'filtro');
    });
  });

  describe('findOne', () => {
    it('should get a peca insumo by id', async () => {
      mockGetUseCase.execute.mockResolvedValue(mockPecaInsumo);

      const result = await controller.findOne('123', mockAuthUser);

      expect(result).toBe(mockPecaInsumo);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith('123');
    });
  });

  describe('update', () => {
    it('should update a peca insumo', async () => {
      const dto: UpdatePecaInsumoDto = { nome: 'Filtro de Ar', preco: 35.5 };
      mockUpdateUseCase.execute.mockResolvedValue({ ...mockPecaInsumo, ...dto });

      const result = await controller.update('123', dto);

      expect(result.nome).toBe('Filtro de Ar');
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith('123', dto);
    });
  });

  describe('updateEstoque', () => {
    it('should update stock quantity', async () => {
      const dto: UpdateEstoquePecaInsumoDto = { quantidade: 25 };
      mockUpdateEstoqueUseCase.execute.mockResolvedValue({
        ...mockPecaInsumo,
        quantidade_estoque: 25,
      });

      const result = await controller.updateEstoque('123', dto);

      expect(result.quantidade_estoque).toBe(25);
      expect(mockUpdateEstoqueUseCase.execute).toHaveBeenCalledWith('123', 25);
    });

    it('should set stock to zero', async () => {
      const dto: UpdateEstoquePecaInsumoDto = { quantidade: 0 };
      mockUpdateEstoqueUseCase.execute.mockResolvedValue({
        ...mockPecaInsumo,
        quantidade_estoque: 0,
      });

      const result = await controller.updateEstoque('123', dto);

      expect(result.quantidade_estoque).toBe(0);
    });
  });

  describe('remove', () => {
    it('should delete a peca insumo', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(mockPecaInsumo);

      const result = await controller.remove('123');

      expect(result).toBe(mockPecaInsumo);
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith('123');
    });
  });
});
