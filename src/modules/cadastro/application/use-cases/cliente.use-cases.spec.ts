import { Cliente } from '../../domain/entities/cliente.entity';
import { IClienteRepository } from '../../domain/interfaces/cliente.interface';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from './cliente.use-cases';

describe('CreateClienteUseCase', () => {
  let useCase: CreateClienteUseCase;
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new CreateClienteUseCase(mockRepository);
  });

  it('should create a cliente with valid data', async () => {
    const input = {
      nome: 'Test Client',
      email: 'test@test.com',
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
    };
    const mockCliente: Cliente = {
      id: '1',
      ...input,
      telefone: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.create.mockResolvedValue(mockCliente);

    const result = await useCase.execute(input);

    expect(result.nome).toBe('Test Client');
    expect(result.email).toBe('test@test.com');
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });

  it('should create a cliente with telefone', async () => {
    const input = {
      nome: 'Test Client',
      email: 'test@test.com',
      telefone: '11999999999',
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
    };
    const mockCliente: Cliente = {
      id: '1',
      ...input,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.create.mockResolvedValue(mockCliente);

    const result = await useCase.execute(input);

    expect(result.telefone).toBe('11999999999');
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });

  it('should create a cliente with CNPJ', async () => {
    const input = {
      nome: 'Test Company',
      email: 'company@test.com',
      documento: '12345678000199',
      tipo_documento: 'CNPJ' as const,
    };
    const mockCliente: Cliente = {
      id: '1',
      ...input,
      telefone: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.create.mockResolvedValue(mockCliente);

    const result = await useCase.execute(input);

    expect(result.tipo_documento).toBe('CNPJ');
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });
});

describe('ListClientesUseCase', () => {
  let useCase: ListClientesUseCase;
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new ListClientesUseCase(mockRepository);
  });

  it('should list clientes with default pagination', async () => {
    const mockData: Cliente[] = [
      {
        id: '1',
        nome: 'Client 1',
        email: 'client1@test.com',
        telefone: null,
        documento: '12345678901',
        tipo_documento: 'CPF' as const,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    const mockPagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
    mockRepository.findAll.mockResolvedValue({ data: mockData, pagination: mockPagination });

    const result = await useCase.execute();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nome).toBe('Client 1');
    expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('should list clientes with custom pagination', async () => {
    const mockPagination = { page: 2, limit: 5, total: 10, totalPages: 2 };
    mockRepository.findAll.mockResolvedValue({ data: [], pagination: mockPagination });

    const result = await useCase.execute(2, 5);

    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(5);
    expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
  });

  it('should list clientes with search', async () => {
    const mockPagination = { page: 1, limit: 10, total: 0, totalPages: 0 };
    mockRepository.findAll.mockResolvedValue({ data: [], pagination: mockPagination });

    await useCase.execute(1, 10, 'test');

    expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'test');
  });
});

describe('GetClienteUseCase', () => {
  let useCase: GetClienteUseCase;
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new GetClienteUseCase(mockRepository);
  });

  it('should get a cliente by id', async () => {
    const mockCliente: Cliente = {
      id: '123',
      nome: 'Test Client',
      email: 'test@test.com',
      telefone: null,
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.findOne.mockResolvedValue(mockCliente);

    const result = await useCase.execute('123');

    expect(result.id).toBe('123');
    expect(result.nome).toBe('Test Client');
    expect(mockRepository.findOne).toHaveBeenCalledWith('123');
  });

  it('should call repository with correct id', async () => {
    const mockCliente: Cliente = {
      id: 'abc-123',
      nome: 'Test Client',
      email: 'test@test.com',
      telefone: null,
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.findOne.mockResolvedValue(mockCliente);

    await useCase.execute('abc-123');

    expect(mockRepository.findOne).toHaveBeenCalledWith('abc-123');
  });
});

describe('UpdateClienteUseCase', () => {
  let useCase: UpdateClienteUseCase;
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new UpdateClienteUseCase(mockRepository);
  });

  it('should update a cliente nome', async () => {
    const updateData = { nome: 'Updated Name' };
    const mockCliente: Cliente = {
      id: '123',
      nome: 'Updated Name',
      email: 'test@test.com',
      telefone: null,
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.update.mockResolvedValue(mockCliente);

    const result = await useCase.execute('123', updateData);

    expect(result.nome).toBe('Updated Name');
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update a cliente email', async () => {
    const updateData = { email: 'newemail@test.com' };
    const mockCliente: Cliente = {
      id: '123',
      nome: 'Test',
      email: 'newemail@test.com',
      telefone: null,
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.update.mockResolvedValue(mockCliente);

    const result = await useCase.execute('123', updateData);

    expect(result.email).toBe('newemail@test.com');
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update a cliente telefone', async () => {
    const updateData = { telefone: '11999999999' };
    const mockCliente: Cliente = {
      id: '123',
      nome: 'Test',
      email: 'test@test.com',
      telefone: '11999999999',
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.update.mockResolvedValue(mockCliente);

    const result = await useCase.execute('123', updateData);

    expect(result.telefone).toBe('11999999999');
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });

  it('should update multiple fields', async () => {
    const updateData = { nome: 'New Name', email: 'new@test.com', telefone: '11988887777' };
    const mockCliente: Cliente = {
      id: '123',
      nome: 'New Name',
      email: 'new@test.com',
      telefone: '11988887777',
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.update.mockResolvedValue(mockCliente);

    const result = await useCase.execute('123', updateData);

    expect(result.nome).toBe('New Name');
    expect(result.email).toBe('new@test.com');
    expect(result.telefone).toBe('11988887777');
    expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
  });
});

describe('DeleteClienteUseCase', () => {
  let useCase: DeleteClienteUseCase;
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IClienteRepository>;
    useCase = new DeleteClienteUseCase(mockRepository);
  });

  it('should delete a cliente by id', async () => {
    const mockCliente: Cliente = {
      id: '123',
      nome: 'Test Client',
      email: 'test@test.com',
      telefone: null,
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.remove.mockResolvedValue(mockCliente);

    const result = await useCase.execute('123');

    expect(result.id).toBe('123');
    expect(mockRepository.remove).toHaveBeenCalledWith('123');
  });

  it('should call repository with correct id', async () => {
    const mockCliente: Cliente = {
      id: 'abc-123',
      nome: 'Test',
      email: 'test@test.com',
      telefone: null,
      documento: '12345678901',
      tipo_documento: 'CPF' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockRepository.remove.mockResolvedValue(mockCliente);

    await useCase.execute('abc-123');

    expect(mockRepository.remove).toHaveBeenCalledWith('abc-123');
  });
});
