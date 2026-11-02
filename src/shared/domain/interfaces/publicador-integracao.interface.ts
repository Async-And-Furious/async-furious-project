import { DomainEvent } from '../events/domain-event.base';

export const PUBLICADOR_INTEGRACAO = Symbol('PUBLICADOR_INTEGRACAO');

/** Evento de integração da saga: todo evento que cruza serviço é de uma OS (ADR-0018). */
export type EventoIntegracao = DomainEvent & { readonly ordemServicoId: string };

/**
 * Publica no broker os eventos que cruzam fronteira de serviço. Separado do
 * `IEmissorEventos`, que continua levando os eventos internos in-process (ADR-0009).
 */
export interface IPublicadorIntegracao {
  publicar(evento: EventoIntegracao): Promise<void>;
}
