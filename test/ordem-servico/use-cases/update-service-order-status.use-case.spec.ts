import { UpdateServiceOrderStatusUseCase } from '../../../src/modules/ordem-servico/application/use-cases/update-service-order-status.use-case';
import { IOrdemServicoRepository } from '../../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import { IStatusHistoryRepository } from '../../../src/modules/ordem-servico/domain/interfaces/status-history.interface';
import { IEmissorEventos } from '../../../src/shared/domain/interfaces/emissor-eventos.interface';
import { StatusTransitionService } from '../../../src/modules/ordem-servico/domain/services/status-transition.service';
import { OrdemDeServico } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import { EntityNotFoundException } from '../../../src/shared/domain/exceptions/entity-not-found.exception';
import type { IOSStatusTransitionLogger } from '../../../src/modules/ordem-servico/application/logging/log-os-status-transition';

describe('UpdateServiceOrderStatusUseCase', () => {
  let useCase: UpdateServiceOrderStatusUseCase;
  let osRepo: jest.Mocked<IOrdemServicoRepository>;
  let historyRepo: jest.Mocked<IStatusHistoryRepository>;
  let emissor: jest.Mocked<IEmissorEventos>;
  let transitionService: StatusTransitionService;
  let transitionLogger: jest.Mocked<IOSStatusTransitionLogger>;

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
    transitionLogger = { log: jest.fn() };

    useCase = new UpdateServiceOrderStatusUseCase(
      osRepo,
      historyRepo,
      emissor,
      transitionService,
      transitionLogger
    );
  });

  it('deve lançar EntityNotFoundException se OS não existir', async () => {
    osRepo.findOne.mockResolvedValue(null as unknown as OrdemDeServico);
    await expect(useCase.execute('invalid-id', 'UNDER_DIAGNOSIS')).rejects.toThrow(
      EntityNotFoundException
    );
  });

  it('deve atualizar o status, salvar histórico e emitir evento', async () => {
    const mockOs = {
      id: 'os-1',
      status: 'RECEIVED',
    } as OrdemDeServico;

    osRepo.findOne.mockResolvedValue(mockOs);
    osRepo.update.mockResolvedValue({ ...mockOs, status: 'UNDER_DIAGNOSIS' } as OrdemDeServico);

    const result = await useCase.execute(
      'os-1',
      'UNDER_DIAGNOSIS',
      'Iniciando diagnóstico via webhook'
    );

    expect(osRepo.update).toHaveBeenCalledWith(
      'os-1',
      expect.objectContaining({ status: 'UNDER_DIAGNOSIS' })
    );
    expect(historyRepo.create).toHaveBeenCalled();
    expect(emissor.emitir).toHaveBeenCalled();
    expect(result.status).toBe('UNDER_DIAGNOSIS');
    expect(transitionLogger.log).not.toHaveBeenCalled();
  });

  it.each([
    ['IN_PROGRESS', 'FINISHED'],
    ['AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION'],
  ] as const)('logs successful generic terminal update %s -> %s', async (from, to) => {
    const mockOs = { id: 'sensitive-order-id', status: from } as OrdemDeServico;
    osRepo.findOne.mockResolvedValue(mockOs);
    osRepo.update.mockResolvedValue({ ...mockOs, status: to } as OrdemDeServico);

    await useCase.execute(mockOs.id, to);

    expect(transitionLogger.log).toHaveBeenCalledTimes(1);
    expect(transitionLogger.log).toHaveBeenCalledWith({
      logType: 'os.status.transition',
      previousStatus: from,
      newStatus: to,
    });
  });

  it('does not log if the generic repository update rejects', async () => {
    osRepo.findOne.mockResolvedValue({ id: 'os-1', status: 'IN_PROGRESS' } as OrdemDeServico);
    osRepo.update.mockRejectedValue(new Error('database unavailable'));

    await expect(useCase.execute('os-1', 'FINISHED')).rejects.toThrow('database unavailable');
    expect(transitionLogger.log).not.toHaveBeenCalled();
  });

  it('does not let a synchronous transition logger failure interrupt history or event work', async () => {
    const mockOs = { id: 'os-1', status: 'IN_PROGRESS' } as OrdemDeServico;
    osRepo.findOne.mockResolvedValue(mockOs);
    osRepo.update.mockResolvedValue({ ...mockOs, status: 'FINISHED' } as OrdemDeServico);
    transitionLogger.log.mockImplementation(() => {
      throw new Error('logger unavailable');
    });

    await expect(useCase.execute('os-1', 'FINISHED')).resolves.toMatchObject({
      status: 'FINISHED',
    });
    expect(historyRepo.create).toHaveBeenCalledTimes(1);
    expect(emissor.emitir).toHaveBeenCalledTimes(1);
  });
});
