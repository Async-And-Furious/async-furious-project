import type { NextFunction, Request, Response } from 'express';
import { RequestLoggingMiddleware } from '../../src/shared/infrastructure/http/request-logging.middleware';

describe('RequestLoggingMiddleware', () => {
  it('propagates a safe correlation id on the request and response', () => {
    const middleware = new RequestLoggingMiddleware();
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/health/live',
      header: (name: string) => (name === 'x-correlation-id' ? 'trace-123' : undefined),
    } as unknown as Request;
    const response = {
      setHeader: jest.fn(),
      once: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(request, response, next);

    expect(response.setHeader).toHaveBeenCalledWith('x-correlation-id', 'trace-123');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
