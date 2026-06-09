import { ConsultarTempoMedioExecucaoUseCase } from '../../../src/modules/ordem-servico/application/use-cases/tempo-medio-execucao.use-case';
import { IOrdemServicoRepository } from '../../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';

describe('ConsultarTempoMedioExecucaoUseCase', () => {
  let mockRepo: jest.Mocked<Pick<IOrdemServicoRepository, 'calcularTempoMedioExecucao'>>;

  beforeEach(() => {
    mockRepo = {
      calcularTempoMedioExecucao: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar tempo médio calculado corretamente', async () => {
    mockRepo.calcularTempoMedioExecucao.mockResolvedValue({ totalMinutos: 300, total: 3 });

    const uc = new ConsultarTempoMedioExecucaoUseCase(
      mockRepo as unknown as IOrdemServicoRepository
    );
    const result = await uc.execute();

    expect(mockRepo.calcularTempoMedioExecucao).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ tempoMedioMinutos: 100, totalOrdensConsideradas: 3 });
  });

  it('deve arredondar o tempo médio', async () => {
    mockRepo.calcularTempoMedioExecucao.mockResolvedValue({ totalMinutos: 100, total: 3 });

    const uc = new ConsultarTempoMedioExecucaoUseCase(
      mockRepo as unknown as IOrdemServicoRepository
    );
    const result = await uc.execute();

    expect(result.tempoMedioMinutos).toBe(33);
  });

  it('deve retornar zero quando não há ordens consideradas', async () => {
    mockRepo.calcularTempoMedioExecucao.mockResolvedValue({ totalMinutos: 0, total: 0 });

    const uc = new ConsultarTempoMedioExecucaoUseCase(
      mockRepo as unknown as IOrdemServicoRepository
    );
    const result = await uc.execute();

    expect(result).toEqual({ tempoMedioMinutos: 0, totalOrdensConsideradas: 0 });
  });

  it('deve propagar erro do repositório', async () => {
    mockRepo.calcularTempoMedioExecucao.mockRejectedValue(new Error('DB error'));

    const uc = new ConsultarTempoMedioExecucaoUseCase(
      mockRepo as unknown as IOrdemServicoRepository
    );

    await expect(uc.execute()).rejects.toThrow('DB error');
  });
});
