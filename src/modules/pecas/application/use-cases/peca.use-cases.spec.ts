import { Peca } from '../../domain/entities/peca.entity';
import { IPecaRepository } from '../../domain/interfaces/peca.interface';
import {
  CreatePecaUseCase,
  ListPecasUseCase,
  GetPecaUseCase,
  UpdatePecaUseCase,
  UpdateEstoquePecaUseCase,
  DeletePecaUseCase,
} from './peca.use-cases';

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

const makeMockRepository = (): jest.Mocked<IPecaRepository> =>
  ({
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateEstoque: jest.fn(),
    remove: jest.fn(),
  }) as unknown as jest.Mocked<IPecaRepository>;

describe('CreatePecaUseCase', () => {
  let useCase: CreatePecaUseCase;
  let mockRepository: jest.Mocked<IPecaRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new CreatePecaUseCase(mockRepository);
  });

  it('should create a peca with all fields', async () => {
    const input = {
      nome: 'Filtro de Óleo',
      codigo: 'FO-001',
      descricao: 'Filtro de óleo para motor 1.0',
      preco: 29.9,
      quantidade_estoque: 10,
      quantidade_minima: 2,
    };
    mockRepository.create.mockResolvedValue(mockPeca);

    const result = await useCase.execute(input);

    expect(result.nome).toBe('Filtro de Óleo');
    expect(result.codigo).toBe('FO-001');
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });

  it('should create a peca without optional fields', async () => {
    const input = { nome: 'Vela de Ignição', codigo: 'VI-001', preco: 15.5 };
    const peca = { ...mockPeca, ...input, descricao: null };
    mockRepository.create.mockResolvedValue(peca);

    const result = await useCase.execute(input);

    expect(result.descricao).toBeNull();
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });

  it('should create a peca with zero initial stock', async () => {
    const input = { nome: 'Correia Dentada', codigo: 'CD-001', preco: 89.9, quantidade_estoque: 0 };
    mockRepository.create.mockResolvedValue({ ...mockPeca, ...input });

    const result = await useCase.execute(input);

    expect(result.quantidade_estoque).toBe(0);
  });
});

describe('ListPecasUseCase', () => {
  let useCase: ListPecasUseCase;
  let mockRepository: jest.Mocked<IPecaRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new ListPecasUseCase(mockRepository);
  });

  it('should list pecas with default pagination', async () => {
    const mockResult = {
      data: [mockPeca],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    mockRepository.findAll.mockResolvedValue(mockResult);

    const result = await useCase.execute();

    expect(result.data).toHaveLength(1);
    expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('should list pecas with custom pagination', async () => {
    const mockResult = {
      data: [],
      pagination: { page: 2, limit: 5, total: 10, totalPages: 2 },
    };
    mockRepository.findAll.mockResolvedValue(mockResult);

    const result = await useCase.execute(2, 5);

    expect(result.pagination.page).toBe(2);
    expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
  });

  it('should list pecas with search', async () => {
    const mockResult = {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
    mockRepository.findAll.mockResolvedValue(mockResult);

    await useCase.execute(1, 10, 'filtro');

    expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'filtro');
  });
});

describe('GetPecaUseCase', () => {
  let useCase: GetPecaUseCase;
  let mockRepository: jest.Mocked<IPecaRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new GetPecaUseCase(mockRepository);
  });

  it('should get a peca by id', async () => {
    mockRepository.findOne.mockResolvedValue(mockPeca);

    const result = await useCase.execute('123');

    expect(result.id).toBe('123');
    expect(mockRepository.findOne).toHaveBeenCalledWith('123');
  });

  it('should call repository with correct id', async () => {
    mockRepository.findOne.mockResolvedValue(mockPeca);

    await useCase.execute('abc-123');

    expect(mockRepository.findOne).toHaveBeenCalledWith('abc-123');
  });
});

describe('UpdatePecaUseCase', () => {
  let useCase: UpdatePecaUseCase;
  let mockRepository: jest.Mocked<IPecaRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new UpdatePecaUseCase(mockRepository);
  });

  it('should update peca nome', async () => {
    const updateData = { nome: 'Filtro de Ar' };
    mockRepository.update.mockResolvedValue({ ...mockPeca, nome: 'Filtro de Ar' });

    const result = await useCase.execute('123', updateData);

    expect(result.nome).toBe('Filtro de Ar');
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update peca preco', async () => {
    const updateData = { preco: 35.5 };
    mockRepository.update.mockResolvedValue({ ...mockPeca, preco: 35.5 });

    const result = await useCase.execute('123', updateData);

    expect(result.preco).toBe(35.5);
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update peca quantidade_minima', async () => {
    const updateData = { quantidade_minima: 5 };
    mockRepository.update.mockResolvedValue({ ...mockPeca, quantidade_minima: 5 });

    const result = await useCase.execute('123', updateData);

    expect(result.quantidade_minima).toBe(5);
  });

  it('should update multiple fields', async () => {
    const updateData = { nome: 'Filtro de Ar', preco: 35.5, descricao: 'Nova descrição' };
    mockRepository.update.mockResolvedValue({ ...mockPeca, ...updateData });

    const result = await useCase.execute('123', updateData);

    expect(result.nome).toBe('Filtro de Ar');
    expect(result.preco).toBe(35.5);
    expect(result.descricao).toBe('Nova descrição');
  });
});

describe('UpdateEstoquePecaUseCase', () => {
  let useCase: UpdateEstoquePecaUseCase;
  let mockRepository: jest.Mocked<IPecaRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new UpdateEstoquePecaUseCase(mockRepository);
  });

  it('should update stock quantity', async () => {
    mockRepository.updateEstoque.mockResolvedValue({ ...mockPeca, quantidade_estoque: 20 });

    const result = await useCase.execute('123', 20);

    expect(result.quantidade_estoque).toBe(20);
    expect(mockRepository.updateEstoque).toHaveBeenCalledWith('123', 20);
  });

  it('should set stock to zero', async () => {
    mockRepository.updateEstoque.mockResolvedValue({ ...mockPeca, quantidade_estoque: 0 });

    const result = await useCase.execute('123', 0);

    expect(result.quantidade_estoque).toBe(0);
  });

  it('should call repository with correct arguments', async () => {
    mockRepository.updateEstoque.mockResolvedValue(mockPeca);

    await useCase.execute('abc-123', 5);

    expect(mockRepository.updateEstoque).toHaveBeenCalledWith('abc-123', 5);
  });
});

describe('DeletePecaUseCase', () => {
  let useCase: DeletePecaUseCase;
  let mockRepository: jest.Mocked<IPecaRepository>;

  beforeEach(() => {
    mockRepository = makeMockRepository();
    useCase = new DeletePecaUseCase(mockRepository);
  });

  it('should delete a peca by id', async () => {
    mockRepository.remove.mockResolvedValue(mockPeca);

    const result = await useCase.execute('123');

    expect(result.id).toBe('123');
    expect(mockRepository.remove).toHaveBeenCalledWith('123');
  });

  it('should call repository with correct id', async () => {
    mockRepository.remove.mockResolvedValue(mockPeca);

    await useCase.execute('abc-123');

    expect(mockRepository.remove).toHaveBeenCalledWith('abc-123');
  });
});
