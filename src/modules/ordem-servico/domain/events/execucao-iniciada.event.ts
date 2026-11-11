import { DomainEvent } from '../../../../shared/domain/events/domain-event.base';

/**
 * Evento de integração publicado pelo Execução e Produção (execucao.eventos.v1).
 * Enquanto o consumidor Kafka não existe, chega pelo EmissorEventos in-process.
 */
export class ExecucaoIniciada extends DomainEvent {
  constructor(public readonly ordemServicoId: string) {
    super();
  }
}
