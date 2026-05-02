import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../src/shared/infrastructure/filters/global-exception.filter';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/v1/test',
      method: 'GET',
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('deve tratar DomainException corretamente', () => {
      const domainException = new DomainException('Erro de domínio');

      filter.catch(domainException, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: expect.any(String),
        path: '/api/v1/test',
        message: 'Erro de domínio',
        error: 'Bad Request',
      });
    });

    it('deve tratar erro genérico', () => {
      const error = new Error('Erro genérico');

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/test',
        message: 'Erro genérico',
        error: 'Internal Server Error',
      });
    });

    it('deve tratar erro sem message', () => {
      const errorWithoutMessage = {
        name: 'ErrorWithoutMessage',
      };

      filter.catch(errorWithoutMessage as any, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/test',
        message: 'Internal server error',
        error: 'Internal Server Error',
      });
    });

    it('deve incluir timestamp válido', () => {
      const error = new Error('Test error');
      const beforeTime = new Date().toISOString();

      filter.catch(error, mockArgumentsHost);

      const afterTime = new Date().toISOString();
      const responseCall = mockResponse.json.mock.calls[0][0];
      const timestamp = responseCall.timestamp;

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    });

    it('deve usar path correto da requisição', () => {
      mockRequest.url = '/api/v1/clientes/123';
      const error = new Error('Test error');

      filter.catch(error, mockArgumentsHost);

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall.path).toBe('/api/v1/clientes/123');
    });
  });

  describe('normalizeErrorName', () => {
    it('deve normalizar nomes de erro conhecidos', () => {
      // Testamos indiretamente através do comportamento do filtro
      const error = new Error('Test error');
      filter.catch(error, mockArgumentsHost);

      const responseCall = mockResponse.json.mock.calls[0][0];
      expect(responseCall.error).toBe('Internal Server Error');
    });
  });
});
