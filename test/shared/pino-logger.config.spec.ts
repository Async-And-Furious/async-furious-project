import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  pinoHttpOptions,
  resolveCorrelationId,
} from '@/shared/infrastructure/logging/pino-logger.config';

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
