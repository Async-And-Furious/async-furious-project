import { ListarOrdensServicoUseCase } from './ordem-servico.use-cases';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';

const makeOS = (
  id: string,
  status: OrdemDeServico['status'],
  created_at: Date
): OrdemDeServico => {
  const os = new OrdemDeServico();
  os.id = id;
  os.veiculoId = 'veiculo-id';
  os.clienteId = 'cliente-id';
  os.status = status;
  os.descricao = null;
  os.iniciada_em = null;
  os.finalizada_em = null;
  os.entregue_em = null;
  os.created_at = created_at;
  os.updated_at = created_at;
  return os;
};

describe('ListarOrdensServicoUseCase', () => {
  let useCase: ListarOrdensServicoUseCase;
  let repository: jest.Mocked<Pick<IOrdemServicoRepository, 'findAllAtivas'>>;

  beforeEach(() => {
    repository = { findAllAtivas: jest.fn() };
    useCase = new ListarOrdensServicoUseCase(
      repository as unknown as IOrdemServicoRepository
    );
  });

  it('deve delegar para findAllAtivas com valores padrão', async () => {
    const paginationResult = {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
    repository.findAllAtivas.mockResolvedValue(paginationResult);

    const result = await useCase.execute();

    expect(repository.findAllAtivas).toHaveBeenCalledWith(undefined, undefined);
    expect(result).toBe(paginationResult);
  });

  it('deve repassar page e limit para o repositório', async () => {
    const paginationResult = {
      data: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    };
    repository.findAllAtivas.mockResolvedValue(paginationResult);

    await useCase.execute(2, 5);

    expect(repository.findAllAtivas).toHaveBeenCalledWith(2, 5);
  });

  it('deve retornar OS ativas ordenadas por prioridade', async () => {
    const os1 = makeOS('os-1', 'RECEIVED', new Date('2024-01-01'));
    const os2 = makeOS('os-2', 'IN_PROGRESS', new Date('2024-01-03'));
    const os3 = makeOS('os-3', 'AWAITING_APPROVAL', new Date('2024-01-02'));

    repository.findAllAtivas.mockResolvedValue({
      data: [os2, os3, os1],
      pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
    });

    const result = await useCase.execute(1, 10);

    expect(result.data[0].status).toBe('IN_PROGRESS');
    expect(result.data[1].status).toBe('AWAITING_APPROVAL');
    expect(result.data[2].status).toBe('RECEIVED');
  });
});
