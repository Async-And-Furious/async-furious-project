import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from '@/modules/cadastro/application/use-cases/cliente.use-cases';
import { IClienteRepository } from '@/modules/cadastro/domain/interfaces/cliente.interface';
import { Cliente } from '@/modules/cadastro/domain/entities/cliente.entity';
import { TipoDocumento } from '@/modules/cadastro/domain/value-objects/cpf-cnpj.vo';

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

      const clienteCriado = Cliente.criar({
        id: '123e4567-e89b-12d3-a456-426614174000',
        nome: input.nome,
        documento: input.documento,
        tipoDocumento: input.tipoDocumento,
        email: input.email,
        telefone: input.telefone,
      });

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

      const clienteCriado = Cliente.criar({
        id: '456e7890-e89b-12d3-a456-426614174001',
        nome: input.nome,
        documento: input.documento,
        tipoDocumento: input.tipoDocumento,
        email: input.email,
        telefone: input.telefone,
      });

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

      const erro = new Error('Erro ao criar cliente');
      mockRepository.create.mockRejectedValue(erro);

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
        Cliente.criar({
          id: '1',
          nome: 'Cliente 1',
          documento: '11144477735',
          tipoDocumento: 'CPF',
          email: 'cliente1@email.com',
          telefone: '11999999999',
        }),
        Cliente.criar({
          id: '2',
          nome: 'Cliente 2',
          documento: '22255588846',
          tipoDocumento: 'CPF',
          email: 'cliente2@email.com',
          telefone: '11888888888',
        }),
      ];

      const pagination = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      };

      mockRepository.findAll.mockResolvedValue({
        data: clientes,
        pagination,
      });

      const resultado = await useCase.execute();

      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(resultado.data).toHaveLength(2);
      expect(resultado.pagination.total).toBe(2);
    });

    it('deve listar clientes com paginação', async () => {
      const clientes = [
        Cliente.criar({
          id: '1',
          nome: 'Cliente 1',
          documento: '11144477735',
          tipoDocumento: 'CPF',
          email: 'cliente1@email.com',
          telefone: '11999999999',
        }),
      ];

      const pagination = {
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
      };

      mockRepository.findAll.mockResolvedValue({
        data: clientes,
        pagination,
      });

      const resultado = await useCase.execute(2, 5);

      expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
      expect(resultado.pagination.page).toBe(2);
      expect(resultado.pagination.limit).toBe(5);
    });

    it('deve listar clientes com busca', async () => {
      const clientes = [
        Cliente.criar({
          id: '1',
          nome: 'João Silva',
          documento: '11144477735',
          tipoDocumento: 'CPF',
          email: 'joao@email.com',
          telefone: '11999999999',
        }),
      ];

      const pagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      };

      mockRepository.findAll.mockResolvedValue({
        data: clientes,
        pagination,
      });

      const resultado = await useCase.execute(1, 10, 'João');

      expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'João');
      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].nome).toBe('João Silva');
    });

    it('deve retornar lista vazia quando não há clientes', async () => {
      const pagination = {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      };

      mockRepository.findAll.mockResolvedValue({
        data: [],
        pagination,
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
      const cliente = Cliente.criar({
        id: clienteId,
        nome: 'João Silva',
        documento: '11144477735',
        tipoDocumento: 'CPF',
        email: 'joao@email.com',
        telefone: '11999999999',
      });

      mockRepository.findById.mockResolvedValue(cliente);

      const resultado = await useCase.execute(clienteId);

      expect(mockRepository.findById).toHaveBeenCalledWith(clienteId);
      expect(resultado.id).toBe(clienteId);
      expect(resultado.nome).toBe('João Silva');
    });

    it('deve propagar erro quando cliente não encontrado', async () => {
      const clienteId = 'id-inexistente';
      const erro = new Error('Cliente não encontrado');

      mockRepository.findById.mockRejectedValue(erro);

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

      const clienteAtualizado = Cliente.criar({
        id: clienteId,
        nome: updateData.nome,
        documento: '11144477735',
        tipoDocumento: 'CPF',
        email: updateData.email,
        telefone: updateData.telefone,
      });

      mockRepository.update.mockResolvedValue(clienteAtualizado);

      const resultado = await useCase.execute(clienteId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(clienteId, updateData);
      expect(resultado.id).toBe(clienteId);
      expect(resultado.nome).toBe(updateData.nome);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        telefone: '11777777777',
      };

      const clienteAtualizado = Cliente.criar({
        id: clienteId,
        nome: 'João Silva',
        documento: '11144477735',
        tipoDocumento: 'CPF',
        email: 'joao@email.com',
        telefone: updateData.telefone,
      });

      mockRepository.update.mockResolvedValue(clienteAtualizado);

      const resultado = await useCase.execute(clienteId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(clienteId, updateData);
      expect(resultado.telefone).toBe(updateData.telefone);
    });

    it('deve propagar erro do repositório', async () => {
      const clienteId = 'id-inexistente';
      const updateData = { nome: 'Novo Nome' };
      const erro = new Error('Cliente não encontrado para atualização');

      mockRepository.update.mockRejectedValue(erro);

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
      const clienteDeletado = Cliente.criar({
        id: clienteId,
        nome: 'João Silva',
        documento: '11144477735',
        tipoDocumento: 'CPF',
        email: 'joao@email.com',
        telefone: '11999999999',
      });

      mockRepository.remove.mockResolvedValue(clienteDeletado);

      const resultado = await useCase.execute(clienteId);

      expect(mockRepository.remove).toHaveBeenCalledWith(clienteId);
      expect(resultado.id).toBe(clienteId);
      expect(resultado.nome).toBe('João Silva');
    });

    it('deve propagar erro quando cliente não encontrado para deleção', async () => {
      const clienteId = 'id-inexistente';
      const erro = new Error('Cliente não encontrado para deleção');

      mockRepository.remove.mockRejectedValue(erro);

      await expect(useCase.execute(clienteId)).rejects.toThrow(
        'Cliente não encontrado para deleção'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(clienteId);
    });

    it('deve propagar erro de integridade referencial', async () => {
      const clienteId = '123e4567-e89b-12d3-a456-426614174000';
      const erro = new Error('Cliente possui veículos associados');

      mockRepository.remove.mockRejectedValue(erro);

      await expect(useCase.execute(clienteId)).rejects.toThrow(
        'Cliente possui veículos associados'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(clienteId);
    });
  });
});
