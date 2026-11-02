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

export interface BlocoRetry {
  attempt: number;
  firstFailedAt: string;
  notBefore: string;
}

export interface EnvelopeRecebido extends EnvelopeEvento {
  data: Record<string, unknown> & { ordemServicoId: string };
  retry?: BlocoRetry;
  lastError?: string;
}

function blocoRetryValido(retry: unknown): retry is BlocoRetry {
  if (!retry || typeof retry !== 'object') return false;
  const { attempt, firstFailedAt, notBefore } = retry as Record<string, unknown>;
  return (
    Number.isInteger(attempt) &&
    typeof firstFailedAt === 'string' &&
    Number.isFinite(Date.parse(firstFailedAt)) &&
    typeof notBefore === 'string' &&
    Number.isFinite(Date.parse(notBefore))
  );
}

/**
 * Valida o envelope de uma mensagem consumida. Exige `correlationId`, `data.ordemServicoId`
 * e a chave do registro iguais (ADR-0018). Devolve `null` se o envelope não serve.
 */
export function lerEnvelope(valor: unknown, chave: string | null): EnvelopeRecebido | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const candidato = valor as Record<string, unknown>;
  const data = candidato.data as Record<string, unknown> | undefined;
  const ordemServicoId = data?.ordemServicoId;
  const camposOk =
    typeof candidato.eventId === 'string' &&
    candidato.eventId.length > 0 &&
    typeof candidato.eventType === 'string' &&
    candidato.eventType.length > 0 &&
    Number.isInteger(candidato.eventVersion) &&
    typeof candidato.occurredAt === 'string' &&
    typeof candidato.producer === 'string' &&
    !!data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof ordemServicoId === 'string' &&
    ordemServicoId.length > 0 &&
    candidato.correlationId === ordemServicoId &&
    chave === ordemServicoId &&
    (candidato.retry === undefined || blocoRetryValido(candidato.retry));
  return camposOk ? (candidato as unknown as EnvelopeRecebido) : null;
}
