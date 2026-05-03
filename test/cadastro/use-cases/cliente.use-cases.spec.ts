import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from '@/modules/cadastro/application/use-cases/cliente.use-cases';
import { IClienteRepository } from '@/modules/cadastro/domain/interfaces/cliente.interface';
import { TipoDocumento } from '@/modules/cadastro/domain/value-objects/cpf-cnpj.vo';
import { makeCliente, makePagination } from '../../support/test-factories';

describe('Cliente Use Cases', () => {
  let mockRepository: jest.Mocked<IClienteRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as jest.Mocked<IClienteRepository>;
  });

  describe('CreateClienteUseCase', () => {
    let useCase: CreateClienteUseCase;

    beforeEach(() => {
      useCase = new CreateClienteUseCase(mockRepository);
    });

    it('deve criar um cliente com CPF com sucesso', async () => {
      const input = {
        nome: 'João Silva',
        documento: '11144477735',
        tipoDocumento: 'CPF' as TipoDocumento,
        email: 'joao@email.com',
        telefone: '11999999999',
      };

      const clienteCriado = makeCliente({ id: '123e4567-e89b-12d3-a456-426614174000', ...input });
      mockRepository.create.mockResolvedValue(clienteCriado);

      const resultado = await useCase.execute(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(resultado.id).toBe(clienteCriado.id);
      expect(resultado.nome).toBe(input.nome);
    });

    it('deve criar cliente com CNPJ', async () => {
      const input = {
        nome: 'Empresa LTDA',
        documento: '11222333000181',
        tipoDocumento: 'CNPJ' as TipoDocumento,
        email: 'empresa@email.com',
        telefone: '1133333333',
      };

      const clienteCriado = makeCliente({ id: '456e7890-e89b-12d3-a456-426614174001', ...input });
      mockRepository.create.mockResolvedValue(clienteCriado);

      const resultado = await useCase.execute(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(resultado.nome).toBe(input.nome);
    });

    it('deve propagar erro do repositório', async () => {
      const input = {
        nome: 'Cliente Teste',
        documento: '11144477735',
        tipoDocumento: 'CPF' as TipoDocumento,
        email: 'teste@email.com',
        telefone: '11999999999',
      };

      mockRepository.create.mockRejectedValue(new Error('Erro ao criar cliente'));

      await expect(useCase.execute(input)).rejects.toThrow('Erro ao criar cliente');
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe('ListClientesUseCase', () => {
    let useCase: ListClientesUseCase;

    beforeEach(() => {
      useCase = new ListClientesUseCase(mockRepository);
    });

    it('deve listar clientes sem parâmetros', async () => {
      const clientes = [
        makeCliente({ id: '1', nome: 'Cliente 1', email: 'cliente1@email.com' }),
        makeCliente({
          id: '2',
          nome: 'Cliente 2',
          documento: '22255588846',
          email: 'cliente2@email.com',
          telefone: '11888888888',
        }),
      ];

      mockRepository.findAll.mockResolvedValue({ data: clientes, pagination: makePagination() });

      const resultado = await useCase.execute();

      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(resultado.data).toHaveLength(2);
      expect(resultado.pagination.total).toBe(2);
    });

    it('deve listar clientes com paginação', async () => {
      const clientes = [makeCliente({ id: '1', email: 'cliente1@email.com' })];

      mockRepository.findAll.mockResolvedValue({
        data: clientes,
        pagination: makePagination({ page: 2, limit: 5, total: 10, totalPages: 2 }),
      });

      const resultado = await useCase.execute(2, 5);

      expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
      expect(resultado.pagination.page).toBe(2);
      expect(resultado.pagination.limit).toBe(5);
    });

    it('deve listar clientes com busca', async () => {
      const clientes = [makeCliente({ id: '1' })];

      mockRepository.findAll.mockResolvedValue({
        data: clientes,
        pagination: makePagination({ total: 1, totalPages: 1 }),
      });

      const resultado = await useCase.execute(1, 10, 'João');

      expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'João');
      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].nome).toBe('João Silva');
    });

    it('deve retornar lista vazia quando não há clientes', async () => {
      mockRepository.findAll.mockResolvedValue({
        data: [],
        pagination: makePagination({ total: 0, totalPages: 0 }),
      });

      const resultado = await useCase.execute();

      expect(resultado.data).toHaveLength(0);
      expect(resultado.pagination.total).toBe(0);
    });
  });

  describe('GetClienteUseCase', () => {
    let useCase: GetClienteUseCase;

    beforeEach(() => {
      useCase = new GetClienteUseCase(mockRepository);
    });

    it('deve buscar cliente por ID com sucesso', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      const cliente = makeCliente({ id: clienteId });
      mockRepository.findById.mockResolvedValue(cliente);

      const resultado = await useCase.execute(clienteId);

      expect(mockRepository.findById).toHaveBeenCalledWith(clienteId);
      expect(resultado.id).toBe(clienteId);
      expect(resultado.nome).toBe('João Silva');
    });

    it('deve propagar erro quando cliente não encontrado', async () => {
      const clienteId = 'id-inexistente';
      mockRepository.findById.mockRejectedValue(new Error('Cliente não encontrado'));

      await expect(useCase.execute(clienteId)).rejects.toThrow('Cliente não encontrado');
      expect(mockRepository.findById).toHaveBeenCalledWith(clienteId);
    });
  });

  describe('UpdateClienteUseCase', () => {
    let useCase: UpdateClienteUseCase;

    beforeEach(() => {
      useCase = new UpdateClienteUseCase(mockRepository);
    });

    it('deve atualizar cliente com sucesso', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        nome: 'João Silva Atualizado',
        email: 'joao.novo@email.com',
        telefone: '11888888888',
      };
      const clienteAtualizado = makeCliente({ id: clienteId, ...updateData });
      mockRepository.update.mockResolvedValue(clienteAtualizado);

      const resultado = await useCase.execute(clienteId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(clienteId, updateData);
      expect(resultado.id).toBe(clienteId);
      expect(resultado.nome).toBe(updateData.nome);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = { telefone: '11777777777' };
      const clienteAtualizado = makeCliente({ id: clienteId, telefone: updateData.telefone });
      mockRepository.update.mockResolvedValue(clienteAtualizado);

      const resultado = await useCase.execute(clienteId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(clienteId, updateData);
      expect(resultado.telefone).toBe(updateData.telefone);
    });

    it('deve propagar erro do repositório', async () => {
      const clienteId = 'id-inexistente';
      const updateData = { nome: 'Novo Nome' };
      mockRepository.update.mockRejectedValue(new Error('Cliente não encontrado para atualização'));

      await expect(useCase.execute(clienteId, updateData)).rejects.toThrow(
        'Cliente não encontrado para atualização'
      );
      expect(mockRepository.update).toHaveBeenCalledWith(clienteId, updateData);
    });
  });

  describe('DeleteClienteUseCase', () => {
    let useCase: DeleteClienteUseCase;

    beforeEach(() => {
      useCase = new DeleteClienteUseCase(mockRepository);
    });

    it('deve deletar cliente com sucesso', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      const clienteDeletado = makeCliente({ id: clienteId });
      mockRepository.remove.mockResolvedValue(clienteDeletado);

      const resultado = await useCase.execute(clienteId);

      expect(mockRepository.remove).toHaveBeenCalledWith(clienteId);
      expect(resultado.id).toBe(clienteId);
      expect(resultado.nome).toBe('João Silva');
    });

    it('deve propagar erro quando cliente não encontrado para deleção', async () => {
      const clienteId = 'id-inexistente';
      mockRepository.remove.mockRejectedValue(new Error('Cliente não encontrado para deleção'));

      await expect(useCase.execute(clienteId)).rejects.toThrow(
        'Cliente não encontrado para deleção'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(clienteId);
    });

    it('deve propagar erro de integridade referencial', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      mockRepository.remove.mockRejectedValue(new Error('Cliente possui veículos associados'));

      await expect(useCase.execute(clienteId)).rejects.toThrow(
        'Cliente possui veículos associados'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(clienteId);
    });
  });
});
