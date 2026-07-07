import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';
import { OSStatus } from '../entities/ordem-servico.entity';
import { OrdemServicoRecebida } from '../events/ordem-servico-recebida.event';
import { OrdemServicoEmDiagnostico } from '../events/ordem-servico-em-diagnostico.event';
import { OrdemServicoAguardandoAprovacao } from '../events/ordem-servico-aguardando-aprovacao.event';
import { OrdemServicoEmExecucao } from '../events/ordem-servico-em-execucao.event';
import { OrdemServicoFinalizada } from '../events/ordem-servico-finalizada.event';
import { OrdemServicoEntregue } from '../events/ordem-servico-entregue.event';

export class StatusTransitionService {
  /**
   * Valida a transição e retorna o evento correspondente.
   */
  public validateAndGetEvent(osId: string, currentStatus: OSStatus, newStatus: OSStatus): DomainEvent {
    if (currentStatus === newStatus) {
      throw new DomainException(`A Ordem de Serviço já está no status ${newStatus}.`);
    }

    const validTransitions: Record<OSStatus, OSStatus[]> = {
      RECEIVED: ['UNDER_DIAGNOSIS', 'CLOSED_WITHOUT_EXECUTION'],
      UNDER_DIAGNOSIS: ['AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION'],
      AWAITING_APPROVAL: ['IN_PROGRESS', 'CLOSED_WITHOUT_EXECUTION'],
      IN_PROGRESS: ['AWAITING_PARTS', 'FINISHED'],
      AWAITING_PARTS: ['IN_PROGRESS'],
      FINISHED: ['DELIVERED'],
      DELIVERED: [],
      CLOSED_WITHOUT_EXECUTION: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new DomainException(`Transição inválida: Não é possível mudar de ${currentStatus} para ${newStatus}.`);
    }

    switch (newStatus) {
      case 'RECEIVED':
        return new OrdemServicoRecebida(osId);
      case 'UNDER_DIAGNOSIS':
        return new OrdemServicoEmDiagnostico(osId);
      case 'AWAITING_APPROVAL':
        return new OrdemServicoAguardandoAprovacao(osId);
      case 'IN_PROGRESS':
        return new OrdemServicoEmExecucao(osId);
      case 'FINISHED':
        return new OrdemServicoFinalizada(osId);
      case 'DELIVERED':
        return new OrdemServicoEntregue(osId);
      default:
        // Caso ocorra transição para outros status que não possuem os eventos previstos inicialmente (ex: AWAITING_PARTS)
        // Pode ser necessário criar eventos adicionais ou usar um genérico.
        // Como o DoD pede apenas aqueles eventos especificamente, vamos retornar nulo ou disparar uma versão base.
        // No escopo deste Tech Challenge, vamos retornar null para evitar erros se a transição não tiver evento.
        return null as any;
    }
  }
}
