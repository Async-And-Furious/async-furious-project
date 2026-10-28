import type { IncomingMessage, ServerResponse } from 'node:http';
import { Writable } from 'node:stream';
import pino from 'pino';
import {
  pinoHttpOptions,
  resolveCorrelationId,
  runWithLogContext,
} from '@/shared/infrastructure/logging/pino-logger.config';

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  const logger = pino({ mixin: pinoHttpOptions.mixin, redact: pinoHttpOptions.redact }, stream);
  return { logger, lines };
}

describe('contexto de log fora do HTTP (consumidor de mensagem)', () => {
  const ordemServicoId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
  const eventId = '0b2b6f0a-9b8b-4c1e-8a2b-7e6f6b2c9e11';

  it('anexa ordemServicoId, eventId e correlationId = ordemServicoId a todo log do handler', async () => {
    const { logger, lines } = captureLogger();

    await runWithLogContext({ ordemServicoId, eventId }, async () => {
      await Promise.resolve();
      logger.info('evento consumido');
    });

    expect(lines[0]).toMatchObject({
      msg: 'evento consumido',
      service: 'os-service',
      correlationId: ordemServicoId,
      ordemServicoId,
      eventId,
    });
  });

  it('não vaza o contexto para logs fora do handler', async () => {
    const { logger, lines } = captureLogger();

    await runWithLogContext({ ordemServicoId, eventId }, () => Promise.resolve());
    logger.info('fora do handler');

    expect(lines[0]).not.toHaveProperty('correlationId');
    expect(lines[0]).not.toHaveProperty('ordemServicoId');
    expect(lines[0]).toHaveProperty('service', 'os-service');
  });

  it('mantém o redact de authorization, cookie e set-cookie', () => {
    const { logger, lines } = captureLogger();

    logger.info({
      req: { headers: { authorization: 'Bearer segredo', cookie: 'sessao=1' } },
      res: { headers: { 'set-cookie': 'sessao=2' } },
    });

    expect(lines[0]).toMatchObject({
      req: { headers: { authorization: '[REDACTED]', cookie: '[REDACTED]' } },
      res: { headers: { 'set-cookie': '[REDACTED]' } },
    });
  });
});

describe('resolveCorrelationId', () => {
  it('reaproveita um x-correlation-id válido enviado pelo cliente', () => {
    const request = { headers: { 'x-correlation-id': 'trace-123' } } as unknown as IncomingMessage;

    expect(resolveCorrelationId(request)).toBe('trace-123');
  });

  it('gera um novo id quando o header enviado tem formato inválido', () => {
    const request = {
      headers: { 'x-correlation-id': 'inválido com espaço e acento' },
    } as unknown as IncomingMessage;

    expect(resolveCorrelationId(request)).not.toBe('inválido com espaço e acento');
    expect(resolveCorrelationId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gera um novo id quando o header não foi enviado', () => {
    const request = { headers: {} } as unknown as IncomingMessage;

    expect(resolveCorrelationId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('usa o primeiro valor quando o header vem duplicado', () => {
    const request = {
      headers: { 'x-correlation-id': ['first-id', 'second-id'] },
    } as unknown as IncomingMessage;

    expect(resolveCorrelationId(request)).toBe('first-id');
  });
});

describe('pinoHttpOptions', () => {
  describe('customProps', () => {
    it('expõe o id da requisição como correlationId nos campos do log', () => {
      const request = { id: 'trace-123' } as unknown as IncomingMessage;

      expect(pinoHttpOptions.customProps?.(request, {} as ServerResponse)).toEqual({
        correlationId: 'trace-123',
      });
    });
  });

  describe('genReqId', () => {
    it('ecoa o correlationId resolvido como header de resposta', () => {
      const setHeader = jest.fn();
      const request = {
        headers: { 'x-correlation-id': 'trace-123' },
      } as unknown as IncomingMessage;
      const response = { setHeader } as unknown as ServerResponse;

      const id = pinoHttpOptions.genReqId?.(request, response);

      expect(id).toBe('trace-123');
      expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'trace-123');
    });
  });

  describe('customLogLevel', () => {
    const level = (statusCode: number, error?: Error) =>
      pinoHttpOptions.customLogLevel?.(
        {} as IncomingMessage,
        { statusCode } as ServerResponse,
        error
      );

    it('retorna error para status 5xx', () => {
      expect(level(500)).toBe('error');
      expect(level(503)).toBe('error');
    });

    it('retorna error quando há um erro, mesmo com status 2xx', () => {
      expect(level(200, new Error('falha assíncrona pós-resposta'))).toBe('error');
    });

    it('retorna warn para status 4xx', () => {
      expect(level(400)).toBe('warn');
      expect(level(404)).toBe('warn');
    });

    it('retorna info para status 2xx/3xx', () => {
      expect(level(200)).toBe('info');
      expect(level(302)).toBe('info');
    });
  });
});
