import { StatusTransitionService } from '../../../src/modules/ordem-servico/domain/services/status-transition.service';
import { DomainException } from '../../../src/shared/domain/exceptions/domain.exception';
import type { OSStatus } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import { OrdemServicoEmDiagnostico } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-em-diagnostico.event';
import { OrdemServicoAguardandoAprovacao } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-aguardando-aprovacao.event';
import { OrdemServicoEmExecucao } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-em-execucao.event';
import { OrdemServicoFinalizada } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-finalizada.event';
import { OrdemServicoEntregue } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-entregue.event';

describe('StatusTransitionService', () => {
  let service: StatusTransitionService;

  beforeEach(() => {
    service = new StatusTransitionService();
  });

  it('deve retornar evento ao transitar de RECEIVED para UNDER_DIAGNOSIS', () => {
    const event = service.validateAndGetEvent('os-123', 'RECEIVED', 'UNDER_DIAGNOSIS');
    expect(event).toBeInstanceOf(OrdemServicoEmDiagnostico);
    expect(event).toEqual(expect.objectContaining({ ordemServicoId: 'os-123' }));
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

  // Transições que os consumidores de eventos do Execução (#334) percorrem.
  it.each<[OSStatus, OSStatus, unknown]>([
    ['UNDER_DIAGNOSIS', 'AWAITING_APPROVAL', OrdemServicoAguardandoAprovacao],
    ['AWAITING_APPROVAL', 'IN_PROGRESS', OrdemServicoEmExecucao],
    ['AWAITING_PARTS', 'IN_PROGRESS', OrdemServicoEmExecucao],
    ['IN_PROGRESS', 'FINISHED', OrdemServicoFinalizada],
    ['FINISHED', 'DELIVERED', OrdemServicoEntregue],
  ])('%s → %s é válida e devolve o evento correspondente', (de, para, classeEvento) => {
    const evento = service.validateAndGetEvent('os-1', de, para);
    expect(evento).toBeInstanceOf(classeEvento);
  });

  it.each<[OSStatus, OSStatus]>([
    ['IN_PROGRESS', 'AWAITING_PARTS'],
    ['AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION'],
  ])('%s → %s é válida, mas não tem evento de domínio associado', (de, para) => {
    expect(service.validateAndGetEvent('os-1', de, para)).toBeNull();
  });

  describe('validarTransicao', () => {
    it('não lança para transição permitida, mesmo sem evento de domínio', () => {
      expect(() => service.validarTransicao('IN_PROGRESS', 'AWAITING_PARTS')).not.toThrow();
      expect(() => service.validarTransicao('AWAITING_PARTS', 'IN_PROGRESS')).not.toThrow();
    });

    it('lança DomainException para transição inválida ou de mesmo status', () => {
      expect(() => service.validarTransicao('AWAITING_APPROVAL', 'AWAITING_PARTS')).toThrow(
        DomainException
      );
      expect(() => service.validarTransicao('RECEIVED', 'RECEIVED')).toThrow(DomainException);
    });
  });

  it.each<[OSStatus, OSStatus]>([
    ['AWAITING_APPROVAL', 'AWAITING_PARTS'],
    ['AWAITING_PARTS', 'FINISHED'],
    ['DELIVERED', 'FINISHED'],
    ['CLOSED_WITHOUT_EXECUTION', 'IN_PROGRESS'],
  ])('%s → %s é inválida', (de, para) => {
    expect(() => service.validateAndGetEvent('os-1', de, para)).toThrow(
      `Transição inválida: Não é possível mudar de ${de} para ${para}.`
    );
  });
});
