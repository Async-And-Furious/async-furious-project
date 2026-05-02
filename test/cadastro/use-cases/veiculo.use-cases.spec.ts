import {
  CreateVeiculoUseCase,
  ListVeiculosUseCase,
  GetVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
} from '@/modules/cadastro/application/use-cases/veiculo.use-cases';
import { IVeiculoRepository } from '@/modules/cadastro/domain/interfaces/veiculo.interface';
import { Veiculo } from '@/modules/cadastro/domain/entities/veiculo.entity';

describe('Veiculo Use Cases', () => {
  let mockRepository: jest.Mocked<IVeiculoRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByPlaca: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as jest.Mocked<IVeiculoRepository>;
  });

  describe('CreateVeiculoUseCase', () => {
    let useCase: CreateVeiculoUseCase;

    beforeEach(() => {
      useCase = new CreateVeiculoUseCase(mockRepository);
    });

    it('deve criar um veículo com sucesso', async () => {
      const input = {
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Branco',
        clienteId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const veiculoCriado = Veiculo.criar({
        id: '456e7890-e89b-12d3-a456-426614174001',
        placa: input.placa,
        marca: input.marca,
        modelo: input.modelo,
        ano: input.ano,
        cor: input.cor,
        clienteId: input.clienteId,
      });

      mockRepository.create.mockResolvedValue(veiculoCriado);

      const resultado = await useCase.execute(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(resultado.id).toBe(veiculoCriado.id);
      expect(resultado.placa).toBe('ABC1234');
      expect(resultado.marca).toBe(input.marca);
      expect(resultado.modelo).toBe(input.modelo);
      expect(resultado.ano).toBe(input.ano);
      expect(resultado.cor).toBe(input.cor);
      expect(resultado.clienteId).toBe(input.clienteId);
    });

    it('deve criar veículo sem cor', async () => {
      const input = {
        placa: 'XYZ-9876',
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2019,
        clienteId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const veiculoCriado = Veiculo.criar({
        id: '456e7890-e89b-12d3-a456-426614174002',
        placa: input.placa,
        marca: input.marca,
        modelo: input.modelo,
        ano: input.ano,
        clienteId: input.clienteId,
      });

      mockRepository.create.mockResolvedValue(veiculoCriado);

      const resultado = await useCase.execute(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(resultado.placa).toBe('XYZ9876');
      expect(resultado.cor).toBeNull();
    });

    it('deve propagar erro do repositório', async () => {
      const input = {
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const erro = new Error('Erro ao criar veículo');
      mockRepository.create.mockRejectedValue(erro);

      await expect(useCase.execute(input)).rejects.toThrow('Erro ao criar veículo');
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe('ListVeiculosUseCase', () => {
    let useCase: ListVeiculosUseCase;

    beforeEach(() => {
      useCase = new ListVeiculosUseCase(mockRepository);
    });

    it('deve listar veículos sem parâmetros', async () => {
      const veiculo1 = Veiculo.criar({
        id: '1',
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Branco',
        clienteId: 'cliente1',
      });

      const veiculo2 = Veiculo.criar({
        id: '2',
        placa: 'XYZ-9876',
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2019,
        clienteId: 'cliente2',
      });

      const veiculos = [veiculo1, veiculo2];

      const pagination = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      };

      mockRepository.findAll.mockResolvedValue({
        data: veiculos,
        pagination,
      });

      const resultado = await useCase.execute();

      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(resultado.data).toHaveLength(2);
      expect(resultado.pagination.total).toBe(2);
    });

    it('deve listar veículos com paginação', async () => {
      const veiculo = Veiculo.criar({
        id: '1',
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cliente1',
      });

      const veiculos = [veiculo];

      const pagination = {
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
      };

      mockRepository.findAll.mockResolvedValue({
        data: veiculos,
        pagination,
      });

      const resultado = await useCase.execute(2, 5);

      expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
      expect(resultado.pagination.page).toBe(2);
      expect(resultado.pagination.limit).toBe(5);
    });

    it('deve listar veículos com busca', async () => {
      const veiculo = Veiculo.criar({
        id: '1',
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        clienteId: 'cliente1',
      });

      const veiculos = [veiculo];

      const pagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      };

      mockRepository.findAll.mockResolvedValue({
        data: veiculos,
        pagination,
      });

      const resultado = await useCase.execute(1, 10, 'Toyota');

      expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'Toyota');
      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].marca).toBe('Toyota');
    });

    it('deve retornar lista vazia quando não há veículos', async () => {
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

    it('deve propagar erro do repositório', async () => {
      const erro = new Error('Erro ao listar veículos');
      mockRepository.findAll.mockRejectedValue(erro);

      await expect(useCase.execute()).rejects.toThrow('Erro ao listar veículos');
    });
  });

  describe('GetVeiculoUseCase', () => {
    let useCase: GetVeiculoUseCase;

    beforeEach(() => {
      useCase = new GetVeiculoUseCase(mockRepository);
    });

    it('deve buscar veículo por ID com sucesso', async () => {
      const veiculoId = '123e4567-e89b-12d3-a456-426614174000';
      const veiculo = Veiculo.criar({
        id: veiculoId,
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Branco',
        clienteId: 'cliente1',
      });

      mockRepository.findById.mockResolvedValue(veiculo);

      const resultado = await useCase.execute(veiculoId);

      expect(mockRepository.findById).toHaveBeenCalledWith(veiculoId);
      expect(resultado.id).toBe(veiculoId);
      expect(resultado.placa).toBe('ABC1234');
      expect(resultado.marca).toBe('Toyota');
    });

    it('deve propagar erro quando veículo não encontrado', async () => {
      const veiculoId = 'id-inexistente';
      const erro = new Error('Veículo não encontrado');

      mockRepository.findById.mockRejectedValue(erro);

      await expect(useCase.execute(veiculoId)).rejects.toThrow('Veículo não encontrado');
      expect(mockRepository.findById).toHaveBeenCalledWith(veiculoId);
    });
  });

  describe('UpdateVeiculoUseCase', () => {
    let useCase: UpdateVeiculoUseCase;

    beforeEach(() => {
      useCase = new UpdateVeiculoUseCase(mockRepository);
    });

    it('deve atualizar veículo com sucesso', async () => {
      const veiculoId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2021,
        cor: 'Preto',
      };

      const veiculoAtualizado = Veiculo.criar({
        id: veiculoId,
        placa: 'ABC-1234',
        marca: updateData.marca,
        modelo: updateData.modelo,
        ano: updateData.ano,
        cor: updateData.cor,
        clienteId: 'cliente1',
      });

      mockRepository.update.mockResolvedValue(veiculoAtualizado);

      const resultado = await useCase.execute(veiculoId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(veiculoId, updateData);
      expect(resultado.id).toBe(veiculoId);
      expect(resultado.marca).toBe(updateData.marca);
      expect(resultado.modelo).toBe(updateData.modelo);
      expect(resultado.ano).toBe(updateData.ano);
      expect(resultado.cor).toBe(updateData.cor);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const veiculoId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        cor: 'Azul',
      };

      const veiculoAtualizado = Veiculo.criar({
        id: veiculoId,
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: updateData.cor,
        clienteId: 'cliente1',
      });

      mockRepository.update.mockResolvedValue(veiculoAtualizado);

      const resultado = await useCase.execute(veiculoId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(veiculoId, updateData);
      expect(resultado.cor).toBe(updateData.cor);
    });

    it('deve propagar erro do repositório', async () => {
      const veiculoId = 'id-inexistente';
      const updateData = { marca: 'Nova Marca' };
      const erro = new Error('Veículo não encontrado para atualização');

      mockRepository.update.mockRejectedValue(erro);

      await expect(useCase.execute(veiculoId, updateData)).rejects.toThrow(
        'Veículo não encontrado para atualização'
      );
      expect(mockRepository.update).toHaveBeenCalledWith(veiculoId, updateData);
    });
  });

  describe('DeleteVeiculoUseCase', () => {
    let useCase: DeleteVeiculoUseCase;

    beforeEach(() => {
      useCase = new DeleteVeiculoUseCase(mockRepository);
    });

    it('deve deletar veículo com sucesso', async () => {
      const veiculoId = '123e4567-e89b-12d3-a456-426614174000';
      const veiculoDeletado = Veiculo.criar({
        id: veiculoId,
        placa: 'ABC-1234',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Branco',
        clienteId: 'cliente1',
      });

      mockRepository.remove.mockResolvedValue(veiculoDeletado);

      const resultado = await useCase.execute(veiculoId);

      expect(mockRepository.remove).toHaveBeenCalledWith(veiculoId);
      expect(resultado.id).toBe(veiculoId);
      expect(resultado.placa).toBe('ABC1234');
      expect(resultado.marca).toBe('Toyota');
    });

    it('deve propagar erro quando veículo não encontrado para deleção', async () => {
      const veiculoId = 'id-inexistente';
      const erro = new Error('Veículo não encontrado para deleção');

      mockRepository.remove.mockRejectedValue(erro);

      await expect(useCase.execute(veiculoId)).rejects.toThrow(
        'Veículo não encontrado para deleção'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(veiculoId);
    });

    it('deve propagar erro de integridade referencial', async () => {
      const veiculoId = '123e4567-e89b-12d3-a456-426614174000';
      const erro = new Error('Veículo está sendo usado em ordens de serviço');

      mockRepository.remove.mockRejectedValue(erro);

      await expect(useCase.execute(veiculoId)).rejects.toThrow(
        'Veículo está sendo usado em ordens de serviço'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(veiculoId);
    });
  });
});
