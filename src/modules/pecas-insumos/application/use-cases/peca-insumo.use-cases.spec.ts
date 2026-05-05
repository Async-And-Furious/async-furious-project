import { PecaInsumo } from '../../domain/entities/peca-insumo.entity';
import { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import {
  CreatePecaInsumoUseCase,
  ListPecasInsumoUseCase,
  GetPecaInsumoUseCase,
  UpdatePecaInsumoUseCase,
  UpdateEstoquePecaInsumoUseCase,
  DeletePecaInsumoUseCase,
} from './peca-insumo.use-cases';

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

const makeMockRepository = (): jest.Mocked<IPecaInsumoRepository> =>
  ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateEstoque: jest.fn(),
    remove: jest.fn(),
  }) as unknown as jest.Mocked<IPecaInsumoRepository>;

describe('CreatePecaInsumoUseCase', () => {
  let useCase: CreatePecaInsumoUseCase;
  let mockRepository: jest.Mocked<IPecaInsumoRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new CreatePecaInsumoUseCase(mockRepository);
  });

  it('should create a peca insumo with all fields', async () => {
    const input = {
      nome: 'Filtro de Óleo',
      codigo: 'FO-001',
      descricao: 'Filtro de óleo para motor 1.0',
      preco: 29.9,
      quantidade_estoque: 10,
      quantidade_minima: 2,
    };
    mockRepository.create.mockResolvedValue(mockPecaInsumo);

    const result = await useCase.execute(input);

    expect(result.nome).toBe('Filtro de Óleo');
    expect(result.codigo).toBe('FO-001');
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });

  it('should create a peca insumo without optional fields', async () => {
    const input = { nome: 'Vela de Ignição', codigo: 'VI-001', preco: 15.5 };
    const peca = { ...mockPecaInsumo, ...input, descricao: null };
    mockRepository.create.mockResolvedValue(peca);

    const result = await useCase.execute(input);

    expect(result.descricao).toBeNull();
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });

  it('should create a peca insumo with zero initial stock', async () => {
    const input = {
      nome: 'Correia Dentada',
      codigo: 'CD-001',
      preco: 89.9,
      quantidade_estoque: 0,
    };
    mockRepository.create.mockResolvedValue({ ...mockPecaInsumo, ...input });

    const result = await useCase.execute(input);

    expect(result.quantidade_estoque).toBe(0);
  });
});

describe('ListPecasInsumoUseCase', () => {
  let useCase: ListPecasInsumoUseCase;
  let mockRepository: jest.Mocked<IPecaInsumoRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new ListPecasInsumoUseCase(mockRepository);
  });

  it('should list pecas insumo with default pagination', async () => {
    const mockResult = {
      data: [mockPecaInsumo],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    mockRepository.findAll.mockResolvedValue(mockResult);

    const result = await useCase.execute();

    expect(result.data).toHaveLength(1);
    expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('should list pecas insumo with custom pagination', async () => {
    const mockResult = {
      data: [],
      pagination: { page: 2, limit: 5, total: 10, totalPages: 2 },
    };
    mockRepository.findAll.mockResolvedValue(mockResult);

    const result = await useCase.execute(2, 5);

    expect(result.pagination.page).toBe(2);
    expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
  });

  it('should list pecas insumo with search', async () => {
    const mockResult = {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
    mockRepository.findAll.mockResolvedValue(mockResult);

    await useCase.execute(1, 10, 'filtro');

    expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'filtro');
  });
});

describe('GetPecaInsumoUseCase', () => {
  let useCase: GetPecaInsumoUseCase;
  let mockRepository: jest.Mocked<IPecaInsumoRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new GetPecaInsumoUseCase(mockRepository);
  });

  it('should get a peca insumo by id', async () => {
    mockRepository.findOne.mockResolvedValue(mockPecaInsumo);

    const result = await useCase.execute('123');

    expect(result.id).toBe('123');
    expect(mockRepository.findOne).toHaveBeenCalledWith('123');
  });

  it('should call repository with correct id', async () => {
    mockRepository.findOne.mockResolvedValue(mockPecaInsumo);

    await useCase.execute('abc-123');

    expect(mockRepository.findOne).toHaveBeenCalledWith('abc-123');
  });
});

describe('UpdatePecaInsumoUseCase', () => {
  let useCase: UpdatePecaInsumoUseCase;
  let mockRepository: jest.Mocked<IPecaInsumoRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new UpdatePecaInsumoUseCase(mockRepository);
  });

  it('should update peca insumo nome', async () => {
    const updateData = { nome: 'Filtro de Ar' };
    mockRepository.update.mockResolvedValue({ ...mockPecaInsumo, nome: 'Filtro de Ar' });

    const result = await useCase.execute('123', updateData);

    expect(result.nome).toBe('Filtro de Ar');
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update peca insumo preco', async () => {
    const updateData = { preco: 35.5 };
    mockRepository.update.mockResolvedValue({ ...mockPecaInsumo, preco: 35.5 });

    const result = await useCase.execute('123', updateData);

    expect(result.preco).toBe(35.5);
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update peca insumo quantidade_minima', async () => {
    const updateData = { quantidade_minima: 5 };
    mockRepository.update.mockResolvedValue({ ...mockPecaInsumo, quantidade_minima: 5 });

    const result = await useCase.execute('123', updateData);

    expect(result.quantidade_minima).toBe(5);
  });

  it('should update multiple fields', async () => {
    const updateData = { nome: 'Filtro de Ar', preco: 35.5, descricao: 'Nova descrição' };
    mockRepository.update.mockResolvedValue({ ...mockPecaInsumo, ...updateData });

    const result = await useCase.execute('123', updateData);

    expect(result.nome).toBe('Filtro de Ar');
    expect(result.preco).toBe(35.5);
    expect(result.descricao).toBe('Nova descrição');
  });
});

describe('UpdateEstoquePecaInsumoUseCase', () => {
  let useCase: UpdateEstoquePecaInsumoUseCase;
  let mockRepository: jest.Mocked<IPecaInsumoRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new UpdateEstoquePecaInsumoUseCase(mockRepository);
  });

  it('should update stock quantity', async () => {
    mockRepository.updateEstoque.mockResolvedValue({
      ...mockPecaInsumo,
      quantidade_estoque: 20,
    });

    const result = await useCase.execute('123', 20);

    expect(result.quantidade_estoque).toBe(20);
    expect(mockRepository.updateEstoque).toHaveBeenCalledWith('123', 20);
  });

  it('should set stock to zero', async () => {
    mockRepository.updateEstoque.mockResolvedValue({
      ...mockPecaInsumo,
      quantidade_estoque: 0,
    });

    const result = await useCase.execute('123', 0);

    expect(result.quantidade_estoque).toBe(0);
  });

  it('should call repository with correct arguments', async () => {
    mockRepository.updateEstoque.mockResolvedValue(mockPecaInsumo);

    await useCase.execute('abc-123', 5);

    expect(mockRepository.updateEstoque).toHaveBeenCalledWith('abc-123', 5);
  });
});

describe('DeletePecaInsumoUseCase', () => {
  let useCase: DeletePecaInsumoUseCase;
  let mockRepository: jest.Mocked<IPecaInsumoRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new DeletePecaInsumoUseCase(mockRepository);
  });

  it('should delete a peca insumo by id', async () => {
    mockRepository.remove.mockResolvedValue(mockPecaInsumo);

    const result = await useCase.execute('123');

    expect(result.id).toBe('123');
    expect(mockRepository.remove).toHaveBeenCalledWith('123');
  });

  it('should call repository with correct id', async () => {
    mockRepository.remove.mockResolvedValue(mockPecaInsumo);

    await useCase.execute('abc-123');

    expect(mockRepository.remove).toHaveBeenCalledWith('abc-123');
  });
});
