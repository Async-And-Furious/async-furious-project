import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

type CorrelatedRequest = Request & { correlationId?: string };

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(request: CorrelatedRequest, response: Response, next: NextFunction): void {
    const supplied = request.header('x-correlation-id');
    const correlationId =
      supplied && /^[a-zA-Z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    const startedAt = Date.now();

    response.once('finish', () => {
      process.stdout.write(
        `${JSON.stringify({
          level: 'info',
          event: 'http_request',
          correlationId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        })}\n`
      );
    });
    next();
  }
}
