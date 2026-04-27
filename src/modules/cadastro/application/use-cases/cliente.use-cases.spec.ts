import { NotFoundException } from '@nestjs/common';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from './cliente.use-cases';
import { Cliente } from '../../domain/entities/cliente.entity';
import { ClienteResponseDto } from '../../presentation/dto/cliente.response.dto';

const makeCliente = (): Cliente =>
  Cliente.criar({
    id: 'cli-1',
    nome: 'João Silva',
    email: 'joao@email.com',
    telefone: '11987654321',
    documento: '529.982.247-25',
    tipoDocumento: 'CPF',
  });

describe('Cliente Use Cases', () => {
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
  });

  describe('CreateClienteUseCase', () => {
    it('should create and return a ClienteResponseDto', async () => {
      const cliente = makeCliente();
      mockRepository.create.mockResolvedValue(cliente);

      const useCase = new CreateClienteUseCase(mockRepository);
      const result = await useCase.execute({
        nome: 'João Silva',
        email: 'joao@email.com',
        telefone: '11987654321',
        documento: '529.982.247-25',
        tipoDocumento: 'CPF',
      });

      expect(result).toBeInstanceOf(ClienteResponseDto);
      expect(result.id).toBe('cli-1');
      expect(result.nome).toBe('João Silva');
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should propagate repository errors', async () => {
      mockRepository.create.mockRejectedValue(new Error('DB error'));
      const useCase = new CreateClienteUseCase(mockRepository);
      await expect(
        useCase.execute({ nome: 'x', email: 'x@x.com', documento: '529.982.247-25', tipoDocumento: 'CPF' })
      ).rejects.toThrow('DB error');
    });
  });

  describe('ListClientesUseCase', () => {
    it('should return a ClienteListResponseDto with pagination', async () => {
      const clientes = [makeCliente()];
      const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
      mockRepository.findAll.mockResolvedValue({ data: clientes, pagination });

      const useCase = new ListClientesUseCase(mockRepository);
      const result = await useCase.execute(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should pass search param to repository', async () => {
      mockRepository.findAll.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      const useCase = new ListClientesUseCase(mockRepository);
      await useCase.execute(1, 10, 'João');
      expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'João');
    });
  });

  describe('GetClienteUseCase', () => {
    it('should return ClienteResponseDto for existing id', async () => {
      mockRepository.findById.mockResolvedValue(makeCliente());
      const useCase = new GetClienteUseCase(mockRepository);
      const result = await useCase.execute('cli-1');
      expect(result.id).toBe('cli-1');
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockRepository.findById.mockRejectedValue(new NotFoundException('Cliente com ID x nao encontrado'));
      const useCase = new GetClienteUseCase(mockRepository);
      await expect(useCase.execute('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('UpdateClienteUseCase', () => {
    it('should return updated ClienteResponseDto', async () => {
      const updated = Cliente.criar({
        id: 'cli-1',
        nome: 'João Atualizado',
        email: 'joao@email.com',
        documento: '529.982.247-25',
        tipoDocumento: 'CPF',
      });
      mockRepository.update.mockResolvedValue(updated);

      const useCase = new UpdateClienteUseCase(mockRepository);
      const result = await useCase.execute('cli-1', { nome: 'João Atualizado' });

      expect(result.nome).toBe('João Atualizado');
      expect(mockRepository.update).toHaveBeenCalledWith('cli-1', { nome: 'João Atualizado' });
    });

    it('should throw NotFoundException when updating non-existent client', async () => {
      mockRepository.update.mockRejectedValue(new NotFoundException('Cliente com ID x nao encontrado'));
      const useCase = new UpdateClienteUseCase(mockRepository);
      await expect(useCase.execute('x', { nome: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('DeleteClienteUseCase', () => {
    it('should return deleted ClienteResponseDto', async () => {
      mockRepository.remove.mockResolvedValue(makeCliente());
      const useCase = new DeleteClienteUseCase(mockRepository);
      const result = await useCase.execute('cli-1');
      expect(result.id).toBe('cli-1');
      expect(mockRepository.remove).toHaveBeenCalledWith('cli-1');
    });

    it('should throw NotFoundException when deleting non-existent client', async () => {
      mockRepository.remove.mockRejectedValue(new NotFoundException('Cliente com ID x nao encontrado'));
      const useCase = new DeleteClienteUseCase(mockRepository);
      await expect(useCase.execute('x')).rejects.toThrow(NotFoundException);
    });
  });
});
