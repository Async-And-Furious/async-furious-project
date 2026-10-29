import { UpdateServiceOrderStatusUseCase } from '../../../src/modules/ordem-servico/application/use-cases/update-service-order-status.use-case';
import { StatusTransitionService } from '../../../src/modules/ordem-servico/domain/services/status-transition.service';
import type { OrdemDeServico } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import type { IOrdemServicoRepository } from '../../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IEmissorEventos } from '../../../src/shared/domain/interfaces/emissor-eventos.interface';
import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';

describe('UpdateServiceOrderStatusUseCase (carimbos de data)', () => {
  let repository: { findOne: jest.Mock; update: jest.Mock };
  let emissor: { emitir: jest.Mock };
  let useCase: UpdateServiceOrderStatusUseCase;

  function ordemEm(status: string): OrdemDeServico {
    return {
      id: 'os-1',
      status,
      finalizada_em: null,
      entregue_em: null,
    } as unknown as OrdemDeServico;
  }

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      update: jest.fn((_id: string, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'os-1', ...data })
      ),
    };
    emissor = { emitir: jest.fn().mockResolvedValue(undefined) };
    useCase = new UpdateServiceOrderStatusUseCase(
      repository as unknown as IOrdemServicoRepository,
      emissor as unknown as IEmissorEventos,
      new StatusTransitionService()
    );
  });

  it('stamps finalizada_em when the order is finished', async () => {
    repository.findOne.mockResolvedValue(ordemEm('IN_PROGRESS'));

    await useCase.execute('os-1', 'FINISHED');

    const [, payload] = repository.update.mock.calls[0];
    expect(payload).toEqual({
      status: 'FINISHED',
      motivo: undefined,
      finalizada_em: expect.any(Date),
    });
    expect(payload).not.toHaveProperty('entregue_em');
    expect(emissor.emitir).toHaveBeenCalledTimes(1);
  });

  it('rejects DELIVERED instead of stamping entregue_em (delivery goes through registrar-entrega)', async () => {
    repository.findOne.mockResolvedValue(ordemEm('FINISHED'));

    await expect(useCase.execute('os-1', 'DELIVERED')).rejects.toThrow(DomainException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('sends only the status for transitions that carry no timestamp', async () => {
    repository.findOne.mockResolvedValue(ordemEm('UNDER_DIAGNOSIS'));

    await useCase.execute('os-1', 'AWAITING_APPROVAL');

    expect(repository.update).toHaveBeenCalledWith('os-1', {
      status: 'AWAITING_APPROVAL',
      motivo: undefined,
    });
  });
});
