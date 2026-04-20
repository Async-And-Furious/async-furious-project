import { Test, TestingModule } from '@nestjs/testing';
import { PecaController } from './peca.controller';
import {
  CreatePecaUseCase,
  ListPecasUseCase,
  GetPecaUseCase,
  UpdatePecaUseCase,
  UpdateEstoquePecaUseCase,
  DeletePecaUseCase,
} from '../application/use-cases/peca.use-cases';
import { CreatePecaDto, UpdatePecaDto, UpdateEstoqueDto, ListQueryDto } from './dto/peca.dto';
import { Peca } from '../domain/entities/peca.entity';
import { AuthUser } from '../../../shared/auth/types/auth.types';

describe('PecaController', () => {
  let controller: PecaController;
  let mockCreateUseCase: jest.Mocked<CreatePecaUseCase>;
  let mockListUseCase: jest.Mocked<ListPecasUseCase>;
  let mockGetUseCase: jest.Mocked<GetPecaUseCase>;
  let mockUpdateUseCase: jest.Mocked<UpdatePecaUseCase>;
  let mockUpdateEstoqueUseCase: jest.Mocked<UpdateEstoquePecaUseCase>;
  let mockDeleteUseCase: jest.Mocked<DeletePecaUseCase>;

  const mockAuthUser: AuthUser = { id: 'user-123', email: 'admin@test.com', name: 'Admin', role: 'admin' };

  const mockPeca: Peca = {
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
    mockCreateUseCase = { execute: jest.fn() } as unknown as jest.Mocked<CreatePecaUseCase>;
    mockListUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ListPecasUseCase>;
    mockGetUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetPecaUseCase>;
    mockUpdateUseCase = { execute: jest.fn() } as unknown as jest.Mocked<UpdatePecaUseCase>;
    mockUpdateEstoqueUseCase = { execute: jest.fn() } as unknown as jest.Mocked<UpdateEstoquePecaUseCase>;
    mockDeleteUseCase = { execute: jest.fn() } as unknown as jest.Mocked<DeletePecaUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PecaController],
      providers: [
        { provide: CreatePecaUseCase, useValue: mockCreateUseCase },
        { provide: ListPecasUseCase, useValue: mockListUseCase },
        { provide: GetPecaUseCase, useValue: mockGetUseCase },
        { provide: UpdatePecaUseCase, useValue: mockUpdateUseCase },
        { provide: UpdateEstoquePecaUseCase, useValue: mockUpdateEstoqueUseCase },
        { provide: DeletePecaUseCase, useValue: mockDeleteUseCase },
      ],
    }).compile();

    controller = module.get<PecaController>(PecaController);
  });

  describe('create', () => {
    it('should create a peca', async () => {
      const dto: CreatePecaDto = { nome: 'Filtro de Óleo', codigo: 'FO-001', preco: 29.9 };
      mockCreateUseCase.execute.mockResolvedValue(mockPeca);

      const result = await controller.create(dto);

      expect(result).toBe(mockPeca);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(dto);
    });

    it('should create a peca without optional fields', async () => {
      const dto: CreatePecaDto = { nome: 'Vela', codigo: 'VI-001', preco: 15.5 };
      mockCreateUseCase.execute.mockResolvedValue({ ...mockPeca, descricao: null });

      const result = await controller.create(dto);

      expect(result.descricao).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should list pecas with default pagination', async () => {
      const mockResult = {
        data: [mockPeca],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.findAll({} as ListQueryDto, mockAuthUser);

      expect(result).toBe(mockResult);
      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should list pecas with custom pagination and search', async () => {
      const mockResult = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      };
      mockListUseCase.execute.mockResolvedValue(mockResult);

      await controller.findAll({ page: 2, limit: 5, search: 'filtro' } as unknown as ListQueryDto, mockAuthUser);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(2, 5, 'filtro');
    });
  });

  describe('findOne', () => {
    it('should get a peca by id', async () => {
      mockGetUseCase.execute.mockResolvedValue(mockPeca);

      const result = await controller.findOne('123', mockAuthUser);

      expect(result).toBe(mockPeca);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith('123');
    });
  });

  describe('update', () => {
    it('should update a peca', async () => {
      const dto: UpdatePecaDto = { nome: 'Filtro de Ar', preco: 35.5 };
      mockUpdateUseCase.execute.mockResolvedValue({ ...mockPeca, ...dto });

      const result = await controller.update('123', dto);

      expect(result.nome).toBe('Filtro de Ar');
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith('123', dto);
    });
  });

  describe('updateEstoque', () => {
    it('should update stock quantity', async () => {
      const dto: UpdateEstoqueDto = { quantidade: 25 };
      mockUpdateEstoqueUseCase.execute.mockResolvedValue({ ...mockPeca, quantidade_estoque: 25 });

      const result = await controller.updateEstoque('123', dto);

      expect(result.quantidade_estoque).toBe(25);
      expect(mockUpdateEstoqueUseCase.execute).toHaveBeenCalledWith('123', 25);
    });

    it('should set stock to zero', async () => {
      const dto: UpdateEstoqueDto = { quantidade: 0 };
      mockUpdateEstoqueUseCase.execute.mockResolvedValue({ ...mockPeca, quantidade_estoque: 0 });

      const result = await controller.updateEstoque('123', dto);

      expect(result.quantidade_estoque).toBe(0);
    });
  });

  describe('remove', () => {
    it('should delete a peca', async () => {
      mockDeleteUseCase.execute.mockResolvedValue(mockPeca);

      const result = await controller.remove('123');

      expect(result).toBe(mockPeca);
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith('123');
    });
  });
});
