import {
  CreateServicoUseCase,
  ListServicosUseCase,
  GetServicoUseCase,
  UpdateServicoUseCase,
  DeleteServicoUseCase,
} from '@/modules/cadastro/application/use-cases/servico.use-cases';
import { IServicoRepository } from '@/modules/cadastro/domain/interfaces/servico.interface';
import { Servico } from '@/modules/cadastro/domain/entities/servico.entity';

function makeServico(overrides: Partial<Servico> = {}): Servico {
  const s = new Servico();
  s.id = overrides.id ?? '123e4567-e89b-12d3-a456-426614174000';
  s.nome = overrides.nome ?? 'Troca de Óleo';
  s.descricao = 'descricao' in overrides ? (overrides.descricao ?? null) : 'Troca de óleo do motor';
  s.preco = overrides.preco ?? 50.0;
  s.created_at = overrides.created_at ?? new Date();
  s.updated_at = overrides.updated_at ?? new Date();
  return s;
}

function makePagination(
  overrides: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}
) {
  return { page: 1, limit: 10, total: 2, totalPages: 1, ...overrides };
}

describe('Servico Use Cases', () => {
  let mockRepository: jest.Mocked<IServicoRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as jest.Mocked<IServicoRepository>;
  });

  describe('CreateServicoUseCase', () => {
    let useCase: CreateServicoUseCase;

    beforeEach(() => {
      useCase = new CreateServicoUseCase(mockRepository);
    });

    it('deve criar um serviço com sucesso', async () => {
      const input = { nome: 'Troca de Óleo', descricao: 'Troca de óleo do motor', preco: 50.0 };
      const servicoCriado = makeServico({ id: '123e4567-e89b-12d3-a456-426614174000', ...input });
      mockRepository.create.mockResolvedValue(servicoCriado);

      const resultado = await useCase.execute(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(resultado.id).toBe(servicoCriado.id);
      expect(resultado.nome).toBe(input.nome);
      expect(resultado.descricao).toBe(input.descricao);
      expect(resultado.preco).toBe(input.preco);
    });

    it('deve criar serviço sem descrição', async () => {
      const input = { nome: 'Alinhamento', preco: 80.0 };
      const servicoCriado = makeServico({
        id: '456e7890-e89b-12d3-a456-426614174001',
        nome: input.nome,
        descricao: null,
        preco: input.preco,
      });
      mockRepository.create.mockResolvedValue(servicoCriado);

      const resultado = await useCase.execute(input);

      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(resultado.nome).toBe(input.nome);
      expect(resultado.preco).toBe(input.preco);
    });

    it('deve propagar erro do repositório', async () => {
      const input = { nome: 'Serviço Teste', preco: 100.0 };
      mockRepository.create.mockRejectedValue(new Error('Erro ao criar serviço'));

      await expect(useCase.execute(input)).rejects.toThrow('Erro ao criar serviço');
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe('ListServicosUseCase', () => {
    let useCase: ListServicosUseCase;

    beforeEach(() => {
      useCase = new ListServicosUseCase(mockRepository);
    });

    it('deve listar serviços sem parâmetros', async () => {
      const servicos = [
        makeServico({ id: '1', descricao: 'Troca de óleo do motor' }),
        makeServico({
          id: '2',
          nome: 'Alinhamento',
          descricao: 'Alinhamento das rodas',
          preco: 80.0,
        }),
      ];

      mockRepository.findAll.mockResolvedValue({ data: servicos, pagination: makePagination() });

      const resultado = await useCase.execute();

      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(resultado.data).toHaveLength(2);
      expect(resultado.pagination.total).toBe(2);
    });

    it('deve listar serviços com paginação', async () => {
      const servicos = [makeServico({ id: '1', descricao: null })];

      mockRepository.findAll.mockResolvedValue({
        data: servicos,
        pagination: makePagination({ page: 2, limit: 5, total: 10, totalPages: 2 }),
      });

      const resultado = await useCase.execute(2, 5);

      expect(mockRepository.findAll).toHaveBeenCalledWith(2, 5, undefined);
      expect(resultado.pagination.page).toBe(2);
      expect(resultado.pagination.limit).toBe(5);
    });

    it('deve listar serviços com busca', async () => {
      const servicos = [makeServico({ id: '1' })];

      mockRepository.findAll.mockResolvedValue({
        data: servicos,
        pagination: makePagination({ total: 1, totalPages: 1 }),
      });

      const resultado = await useCase.execute(1, 10, 'óleo');

      expect(mockRepository.findAll).toHaveBeenCalledWith(1, 10, 'óleo');
      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].nome).toBe('Troca de Óleo');
    });

    it('deve retornar lista vazia quando não há serviços', async () => {
      mockRepository.findAll.mockResolvedValue({
        data: [],
        pagination: makePagination({ total: 0, totalPages: 0 }),
      });

      const resultado = await useCase.execute();

      expect(resultado.data).toHaveLength(0);
      expect(resultado.pagination.total).toBe(0);
    });

    it('deve propagar erro do repositório', async () => {
      mockRepository.findAll.mockRejectedValue(new Error('Erro ao listar serviços'));

      await expect(useCase.execute()).rejects.toThrow('Erro ao listar serviços');
    });
  });

  describe('GetServicoUseCase', () => {
    let useCase: GetServicoUseCase;

    beforeEach(() => {
      useCase = new GetServicoUseCase(mockRepository);
    });

    it('deve buscar serviço por ID com sucesso', async () => {
      const servicoId = '123e4567-e89b-12d3-a456-426614174000';
      const servico = makeServico({ id: servicoId });
      mockRepository.findOne.mockResolvedValue(servico);

      const resultado = await useCase.execute(servicoId);

      expect(mockRepository.findOne).toHaveBeenCalledWith(servicoId);
      expect(resultado.id).toBe(servicoId);
      expect(resultado.nome).toBe('Troca de Óleo');
    });

    it('deve propagar erro quando serviço não encontrado', async () => {
      const servicoId = 'id-inexistente';
      mockRepository.findOne.mockRejectedValue(new Error('Serviço não encontrado'));

      await expect(useCase.execute(servicoId)).rejects.toThrow('Serviço não encontrado');
      expect(mockRepository.findOne).toHaveBeenCalledWith(servicoId);
    });
  });

  describe('UpdateServicoUseCase', () => {
    let useCase: UpdateServicoUseCase;

    beforeEach(() => {
      useCase = new UpdateServicoUseCase(mockRepository);
    });

    it('deve atualizar serviço com sucesso', async () => {
      const servicoId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        nome: 'Troca de Óleo Premium',
        descricao: 'Troca de óleo sintético premium',
        preco: 75.0,
      };
      const servicoAtualizado = makeServico({
        id: servicoId,
        ...updateData,
        created_at: new Date('2024-01-01'),
      });
      mockRepository.update.mockResolvedValue(servicoAtualizado);

      const resultado = await useCase.execute(servicoId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(servicoId, updateData);
      expect(resultado.id).toBe(servicoId);
      expect(resultado.nome).toBe(updateData.nome);
      expect(resultado.descricao).toBe(updateData.descricao);
      expect(resultado.preco).toBe(updateData.preco);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      const servicoId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = { preco: 60.0 };
      const servicoAtualizado = makeServico({
        id: servicoId,
        preco: updateData.preco,
        created_at: new Date('2024-01-01'),
      });
      mockRepository.update.mockResolvedValue(servicoAtualizado);

      const resultado = await useCase.execute(servicoId, updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(servicoId, updateData);
      expect(resultado.preco).toBe(updateData.preco);
    });

    it('deve propagar erro do repositório', async () => {
      const servicoId = 'id-inexistente';
      const updateData = { nome: 'Novo Nome' };
      mockRepository.update.mockRejectedValue(new Error('Serviço não encontrado para atualização'));

      await expect(useCase.execute(servicoId, updateData)).rejects.toThrow(
        'Serviço não encontrado para atualização'
      );
      expect(mockRepository.update).toHaveBeenCalledWith(servicoId, updateData);
    });
  });

  describe('DeleteServicoUseCase', () => {
    let useCase: DeleteServicoUseCase;

    beforeEach(() => {
      useCase = new DeleteServicoUseCase(mockRepository);
    });

    it('deve deletar serviço com sucesso', async () => {
      const servicoId = '123e4567-e89b-12d3-a456-426614174000';
      const servicoDeletado = makeServico({ id: servicoId, created_at: new Date('2024-01-01') });
      mockRepository.remove.mockResolvedValue(servicoDeletado);

      const resultado = await useCase.execute(servicoId);

      expect(mockRepository.remove).toHaveBeenCalledWith(servicoId);
      expect(resultado.id).toBe(servicoId);
      expect(resultado.nome).toBe('Troca de Óleo');
    });

    it('deve propagar erro quando serviço não encontrado para deleção', async () => {
      const servicoId = 'id-inexistente';
      mockRepository.remove.mockRejectedValue(new Error('Serviço não encontrado para deleção'));

      await expect(useCase.execute(servicoId)).rejects.toThrow(
        'Serviço não encontrado para deleção'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(servicoId);
    });

    it('deve propagar erro de integridade referencial', async () => {
      const servicoId = '123e4567-e89b-12d3-a456-426614174000';
      mockRepository.remove.mockRejectedValue(
        new Error('Serviço está sendo usado em ordens de serviço')
      );

      await expect(useCase.execute(servicoId)).rejects.toThrow(
        'Serviço está sendo usado em ordens de serviço'
      );
      expect(mockRepository.remove).toHaveBeenCalledWith(servicoId);
    });
  });
});
