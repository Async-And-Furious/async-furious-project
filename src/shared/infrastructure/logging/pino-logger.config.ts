import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

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
