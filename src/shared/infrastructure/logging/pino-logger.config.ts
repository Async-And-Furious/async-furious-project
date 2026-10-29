import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
// Nome do serviço em todo log (contrato de log, docs/infrastructure/observability.md).
const SERVICE_NAME = process.env.SERVICE_NAME ?? 'os-service';

/** Campos do envelope do evento consumido (ADR-0018). */
export interface MessageLogContext {
  ordemServicoId: string;
  eventId: string;
}

const messageLogContext = new AsyncLocalStorage<MessageLogContext>();

/**
 * Executa o handler de uma mensagem do broker com o envelope anexado a todo
 * log emitido dentro dele, inclusive depois de awaits. No consumo,
 * correlationId = ordemServicoId (ADR-0018).
 * ponytail: usar só em consumidor, fora de requisição HTTP; dentro dela o
 * log já tem o correlationId da requisição e o campo sairia duplicado.
 */
export function runWithLogContext<T>(context: MessageLogContext, handler: () => T): T {
  return messageLogContext.run(context, handler);
}

function messageLogFields(): Record<string, string> {
  const context = messageLogContext.getStore();
  return context ? { correlationId: context.ordemServicoId, ...context } : {};
}

export function resolveCorrelationId(request: IncomingMessage): string {
  const header = request.headers[CORRELATION_ID_HEADER];
  const supplied = Array.isArray(header) ? header[0] : header;
  return supplied && CORRELATION_ID_PATTERN.test(supplied) ? supplied : randomUUID();
}

export const pinoHttpOptions: Options = {
  genReqId: (request, response) => {
    const correlationId = resolveCorrelationId(request);
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    return correlationId;
  },
  customProps: (request) => ({ correlationId: request.id }),
  mixin: () => ({ service: SERVICE_NAME, ...messageLogFields() }),
  customLogLevel: (_request, response, error) => {
    if (error || response.statusCode >= 500) return 'error';
    if (response.statusCode >= 400) return 'warn';
    return 'info';
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
};
