import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../../domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../domain/exceptions/entity-not-found.exception';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const headerCorrelationId =
      typeof request.header === 'function' ? request.header('x-correlation-id') : undefined;
    const correlationId = request.correlationId ?? headerCorrelationId;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof EntityNotFoundException) {
      statusCode = HttpStatus.NOT_FOUND;
      message = exception.message;
      error = 'Not Found';
    } else if (exception instanceof DomainException) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;
      error = 'Bad Request';
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string | string[]) || exception.message;
        error = (resp.error as string) || exception.name;
      }

      error = this.normalizeErrorName(error);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(correlationId ? { correlationId } : {}),
    };

    process.stderr.write(
      `${JSON.stringify({
        level: Number(statusCode) >= 500 ? 'error' : 'warn',
        event: 'http_error',
        correlationId,
        method: request.method,
        path: request.url,
        statusCode,
        error,
        message,
      })}\n`
    );

    response.status(statusCode).json(errorResponse);
  }

  private normalizeErrorName(error: string): string {
    const errorNames: Record<string, string> = {
      'Bad Request': 'Bad Request',
      Unauthorized: 'Unauthorized',
      Forbidden: 'Forbidden',
      'Not Found': 'Not Found',
      Conflict: 'Conflict',
      'Internal Server Error': 'Internal Server Error',
    };

    return errorNames[error] || 'Error';
  }
}
