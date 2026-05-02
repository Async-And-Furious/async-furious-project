import { Test, TestingModule } from '@nestjs/testing';
import { ServicoController } from '../../src/modules/cadastro/presentation/controllers/servico.controller';
import {
  CreateServicoUseCase,
  ListServicosUseCase,
  GetServicoUseCase,
  UpdateServicoUseCase,
  DeleteServicoUseCase,
} from '../../src/modules/cadastro/application/use-cases/servico.use-cases';
import {
  CreateServicoDto,
  UpdateServicoDto,
  ListQueryDto,
} from '../../src/modules/cadastro/presentation/dto/servico.dto';
import { Role } from '../../src/auth/enums/role.enum';
import type { AuthUser } from '../../src/auth/types/auth.types';
import { Servico } from '../../src/modules/cadastro/domain/entities/servico.entity';

describe('ServicoController', () => {
  let controller: ServicoController;
  let mockCreateUseCase: jest.Mocked<CreateServicoUseCase>;
  let mockListUseCase: jest.Mocked<ListServicosUseCase>;
  let mockGetUseCase: jest.Mocked<GetServicoUseCase>;
  let mockUpdateUseCase: jest.Mocked<UpdateServicoUseCase>;
  let mockDeleteUseCase: jest.Mocked<DeleteServicoUseCase>;

  const mockUser: AuthUser = {
    id: '1',
    email: 'admin@test.com',
    role: Role.ADMIN,
  };

  const mockServico: Servico = {
    id: 'servico-1',
    nome: 'Lavagem completa',
    descricao: 'Lavagem interna e externa',
    preco: 120.5,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockCreateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateServicoUseCase>;

    mockListUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListServicosUseCase>;

    mockGetUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetServicoUseCase>;

    mockUpdateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateServicoUseCase>;

    mockDeleteUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DeleteServicoUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicoController],
      providers: [
        {
          provide: CreateServicoUseCase,
          useValue: mockCreateUseCase,
        },
        {
          provide: ListServicosUseCase,
          useValue: mockListUseCase,
        },
        {
          provide: GetServicoUseCase,
          useValue: mockGetUseCase,
        },
        {
          provide: UpdateServicoUseCase,
          useValue: mockUpdateUseCase,
        },
        {
          provide: DeleteServicoUseCase,
          useValue: mockDeleteUseCase,
        },
      ],
    }).compile();

    controller = module.get<ServicoController>(ServicoController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('deve criar um novo servico com sucesso', async () => {
      const createDto: CreateServicoDto = {
        nome: 'Lavagem completa',
        descricao: 'Lavagem interna e externa',
        preco: 120.5,
      };

      mockCreateUseCase.execute.mockResolvedValue(mockServico);

      const result = await controller.create(createDto);

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockServico);
    });

    it('deve criar servico sem descricao', async () => {
      const createDto: CreateServicoDto = {
        nome: 'Lavagem simples',
        preco: 80.0,
      };

      const servicoSemDescricao: Servico = {
        ...mockServico,
        nome: 'Lavagem simples',
        descricao: null,
        preco: 80.0,
      };

      mockCreateUseCase.execute.mockResolvedValue(servicoSemDescricao);

      const result = await controller.create(createDto);

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(servicoSemDescricao);
    });
  });

  describe('findAll', () => {
    it('deve listar servicos com parametros padrao', async () => {
      const query: ListQueryDto = {};
      const mockResponse = {
        data: [mockServico],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      mockListUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query, mockUser);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('deve listar servicos com parametros customizados', async () => {
      const query: ListQueryDto = {
        page: 2,
        limit: 5,
        search: 'Lavagem',
      };
      const mockResponse = {
        data: [mockServico],
        pagination: {
          page: 2,
          limit: 5,
          total: 1,
          totalPages: 1,
        },
      };

      mockListUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query, mockUser);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(2, 5, 'Lavagem');
      expect(result).toEqual(mockResponse);
    });

    it('deve usar valores padrao quando parametros sao invalidos', async () => {
      const query: ListQueryDto = {
        page: 0,
        limit: -1,
      };
      const mockResponse = {
        data: [mockServico],
        pagination: {
          page: 1,
          limit: -1,
          total: 1,
          totalPages: 1,
        },
      };

      mockListUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query, mockUser);

      // O controller passa os valores como recebidos, a validação acontece no use case
      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, -1, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findOne', () => {
    it('deve buscar servico por ID com sucesso', async () => {
      const servicoId = 'servico-1';

      mockGetUseCase.execute.mockResolvedValue(mockServico);

      const result = await controller.findOne(servicoId, mockUser);

      expect(mockGetUseCase.execute).toHaveBeenCalledWith(servicoId);
      expect(result).toEqual(mockServico);
    });

    it('deve chamar use case mesmo com usuario diferente', async () => {
      const servicoId = 'servico-1';
      const outroUser: AuthUser = {
        id: '2',
        email: 'user@test.com',
        role: Role.ADMIN,
      };

      mockGetUseCase.execute.mockResolvedValue(mockServico);

      const result = await controller.findOne(servicoId, outroUser);

      expect(mockGetUseCase.execute).toHaveBeenCalledWith(servicoId);
      expect(result).toEqual(mockServico);
    });
  });

  describe('update', () => {
    it('deve atualizar servico com sucesso', async () => {
      const servicoId = 'servico-1';
      const updateDto: UpdateServicoDto = {
        nome: 'Lavagem premium',
        preco: 200.0,
      };

      const servicoAtualizado: Servico = {
        ...mockServico,
        nome: 'Lavagem premium',
        preco: 200.0,
      };

      mockUpdateUseCase.execute.mockResolvedValue(servicoAtualizado);

      const result = await controller.update(servicoId, updateDto);

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(servicoId, updateDto);
      expect(result).toEqual(servicoAtualizado);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const servicoId = 'servico-1';
      const updateDto: UpdateServicoDto = {
        descricao: 'Nova descricao',
      };

      const servicoAtualizado: Servico = {
        ...mockServico,
        descricao: 'Nova descricao',
      };

      mockUpdateUseCase.execute.mockResolvedValue(servicoAtualizado);

      const result = await controller.update(servicoId, updateDto);

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(servicoId, updateDto);
      expect(result).toEqual(servicoAtualizado);
    });

    it('deve atualizar com DTO vazio', async () => {
      const servicoId = 'servico-1';
      const updateDto: UpdateServicoDto = {};

      mockUpdateUseCase.execute.mockResolvedValue(mockServico);

      const result = await controller.update(servicoId, updateDto);

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(servicoId, updateDto);
      expect(result).toEqual(mockServico);
    });
  });

  describe('remove', () => {
    it('deve deletar servico com sucesso', async () => {
      const servicoId = 'servico-1';

      mockDeleteUseCase.execute.mockResolvedValue(mockServico);

      const result = await controller.remove(servicoId);

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith(servicoId);
      expect(result).toEqual(mockServico);
    });

    it('deve chamar delete use case com ID correto', async () => {
      const servicoId = 'outro-servico-id';

      mockDeleteUseCase.execute.mockResolvedValue(mockServico);

      const result = await controller.remove(servicoId);

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith(servicoId);
      expect(mockDeleteUseCase.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockServico);
    });
  });

  describe('integração com use cases', () => {
    it('deve chamar todos os use cases corretamente', async () => {
      // Teste de criação
      const createDto: CreateServicoDto = {
        nome: 'Teste',
        preco: 100,
      };
      mockCreateUseCase.execute.mockResolvedValue(mockServico);
      await controller.create(createDto);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(createDto);

      // Teste de listagem
      const query: ListQueryDto = { page: 1, limit: 10 };
      const mockList = {
        data: [mockServico],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockListUseCase.execute.mockResolvedValue(mockList);
      await controller.findAll(query, mockUser);
      expect(mockListUseCase.execute).toHaveBeenCalledWith(1, 10, undefined);

      // Teste de busca por ID
      mockGetUseCase.execute.mockResolvedValue(mockServico);
      await controller.findOne('servico-1', mockUser);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith('servico-1');

      // Teste de atualização
      const updateDto: UpdateServicoDto = { nome: 'Atualizado' };
      const servicoAtualizado: Servico = { ...mockServico, nome: 'Atualizado' };
      mockUpdateUseCase.execute.mockResolvedValue(servicoAtualizado);
      await controller.update('servico-1', updateDto);
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith('servico-1', updateDto);

      // Teste de remoção
      mockDeleteUseCase.execute.mockResolvedValue(mockServico);
      await controller.remove('servico-1');
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith('servico-1');
    });
  });
});
