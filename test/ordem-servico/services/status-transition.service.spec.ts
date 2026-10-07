import { StatusTransitionService } from '../../../src/modules/ordem-servico/domain/services/status-transition.service';
import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import { OrdemServicoEmDiagnostico } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-em-diagnostico.event';

describe('StatusTransitionService', () => {
  let service: StatusTransitionService;

  beforeEach(() => {
    service = new StatusTransitionService();
  });

  it('deve retornar evento ao transitar de RECEIVED para UNDER_DIAGNOSIS', () => {
    const event = service.validateAndGetEvent('os-123', 'RECEIVED', 'UNDER_DIAGNOSIS');
    expect(event).toBeInstanceOf(OrdemServicoEmDiagnostico);
    expect((event as any).ordemServicoId).toBe('os-123');
  });

  it('deve lançar erro se o status for igual', () => {
    expect(() => service.validateAndGetEvent('os-1', 'RECEIVED', 'RECEIVED')).toThrow(
      DomainException
    );
  });

  it('deve lançar erro para transição inválida (ex: RECEIVED para FINISHED)', () => {
    expect(() => service.validateAndGetEvent('os-1', 'RECEIVED', 'FINISHED')).toThrow(
      DomainException
    );
  });

  it.each([
    ['UNDER_DIAGNOSIS', 'AWAITING_APPROVAL', 'OrdemServicoAguardandoAprovacao'],
    ['AWAITING_APPROVAL', 'IN_PROGRESS', 'OrdemServicoEmExecucao'],
    ['IN_PROGRESS', 'FINISHED', 'OrdemServicoFinalizada'],
    ['FINISHED', 'DELIVERED', 'OrdemServicoEntregue'],
    ['RECEIVED', 'CLOSED_WITHOUT_EXECUTION', undefined],
    ['IN_PROGRESS', 'AWAITING_PARTS', undefined],
  ] as const)('deve mapear a transição %s -> %s', (currentStatus, newStatus, eventName) => {
    const event = service.validateAndGetEvent('os-123', currentStatus, newStatus);
    expect(eventName ? event.constructor.name : event).toBe(eventName ?? null);
  });
});
