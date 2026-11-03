import type { EventoIntegracao } from '../../domain/interfaces/publicador-integracao.interface';
import { OS_PRODUCER } from './kafka.config';

export interface EnvelopeEvento {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId: string;
  producer: string;
  data: Record<string, unknown>;
}

/**
 * Envelope padrão da ADR-0018. `correlationId` é sempre o `ordemServicoId`, que também
 * fica dentro de `data` e vira a chave do registro. `eventId` e `occurredAt` vêm do próprio
 * evento de domínio, para o log in-process e a mensagem no broker apontarem o mesmo evento.
 */
export function montarEnvelope(evento: EventoIntegracao, eventVersion = 1): EnvelopeEvento {
  const { eventId, ocorridoEm, ...data } = evento;
  return {
    eventId,
    eventType: evento.constructor.name,
    eventVersion,
    occurredAt: ocorridoEm.toISOString(),
    correlationId: evento.ordemServicoId,
    producer: OS_PRODUCER,
    data: { ...data },
  };
}
