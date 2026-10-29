import { UpdateServiceOrderStatusUseCase } from '../../../src/modules/ordem-servico/application/use-cases/update-service-order-status.use-case';
import { IOrdemServicoRepository } from '../../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import { IEmissorEventos } from '../../../src/shared/domain/interfaces/emissor-eventos.interface';
import { StatusTransitionService } from '../../../src/modules/ordem-servico/domain/services/status-transition.service';
import { OrdemDeServico } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import { EntityNotFoundException } from '../../../src/shared/domain/exceptions/entity-not-found.exception';
import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';

describe('UpdateServiceOrderStatusUseCase', () => {
  let useCase: UpdateServiceOrderStatusUseCase;
  let osRepo: jest.Mocked<IOrdemServicoRepository>;
  let emissor: jest.Mocked<IEmissorEventos>;
  let transitionService: StatusTransitionService;

  beforeEach(() => {
    osRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IOrdemServicoRepository>;

    emissor = {
      emitir: jest.fn(),
    } as unknown as jest.Mocked<IEmissorEventos>;

    transitionService = new StatusTransitionService();

    useCase = new UpdateServiceOrderStatusUseCase(osRepo, emissor, transitionService);
  });

  it('deve lançar EntityNotFoundException se OS não existir', async () => {
    osRepo.findOne.mockResolvedValue(null as any);
    await expect(useCase.execute('invalid-id', 'UNDER_DIAGNOSIS')).rejects.toThrow(
      EntityNotFoundException
    );
  });

  it('deve atualizar o status com o motivo (o histórico é do repository) e emitir evento', async () => {
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

    expect(osRepo.update).toHaveBeenCalledWith('os-1', {
      status: 'UNDER_DIAGNOSIS',
      motivo: 'Iniciando diagnóstico via webhook',
    });
    expect(emissor.emitir).toHaveBeenCalled();
    expect(result.status).toBe('UNDER_DIAGNOSIS');
  });

  it('deve rejeitar a transição para DELIVERED sem gravar nada', async () => {
    await expect(useCase.execute('os-1', 'DELIVERED')).rejects.toThrow(DomainException);

    expect(osRepo.findOne).not.toHaveBeenCalled();
    expect(osRepo.update).not.toHaveBeenCalled();
    expect(emissor.emitir).not.toHaveBeenCalled();
  });
});
