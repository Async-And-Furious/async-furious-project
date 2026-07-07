import { UpdateServiceOrderStatusUseCase } from '../../../src/modules/ordem-servico/application/use-cases/update-service-order-status.use-case';
import { IOrdemServicoRepository } from '../../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import { IStatusHistoryRepository } from '../../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import { IEmissorEventos } from '../../../src/shared/domain/interfaces/emissor-eventos.interface';
import { StatusTransitionService } from '../../../src/modules/ordem-servico/domain/services/status-transition.service';
import { OrdemDeServico } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import { EntityNotFoundException } from '../../../src/shared/domain/exceptions/entity-not-found.exception';

describe('UpdateServiceOrderStatusUseCase', () => {
  let useCase: UpdateServiceOrderStatusUseCase;
  let osRepo: jest.Mocked<IOrdemServicoRepository>;
  let historyRepo: jest.Mocked<IStatusHistoryRepository>;
  let emissor: jest.Mocked<IEmissorEventos>;
  let transitionService: StatusTransitionService;

  beforeEach(() => {
    osRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IOrdemServicoRepository>;

    historyRepo = {
      create: jest.fn(),
    } as unknown as jest.Mocked<IStatusHistoryRepository>;

    emissor = {
      emitir: jest.fn(),
    } as unknown as jest.Mocked<IEmissorEventos>;

    transitionService = new StatusTransitionService();

    useCase = new UpdateServiceOrderStatusUseCase(osRepo, historyRepo, emissor, transitionService);
  });

  it('deve lançar EntityNotFoundException se OS não existir', async () => {
    osRepo.findOne.mockResolvedValue(null as any);
    await expect(useCase.execute('invalid-id', 'UNDER_DIAGNOSIS')).rejects.toThrow(EntityNotFoundException);
  });

  it('deve atualizar o status, salvar histórico e emitir evento', async () => {
    const mockOs = {
      id: 'os-1',
      status: 'RECEIVED',
    } as OrdemDeServico;

    osRepo.findOne.mockResolvedValue(mockOs);
    osRepo.update.mockResolvedValue({ ...mockOs, status: 'UNDER_DIAGNOSIS' } as OrdemDeServico);

    const result = await useCase.execute('os-1', 'UNDER_DIAGNOSIS', 'Iniciando diagnóstico via webhook');

    expect(osRepo.update).toHaveBeenCalledWith('os-1', expect.objectContaining({ status: 'UNDER_DIAGNOSIS' }));
    expect(historyRepo.create).toHaveBeenCalled();
    expect(emissor.emitir).toHaveBeenCalled();
    expect(result.status).toBe('UNDER_DIAGNOSIS');
  });
});
