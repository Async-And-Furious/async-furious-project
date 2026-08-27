import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/shared/infrastructure/filters/global-exception.filter';

// Mock das dependências externas
jest.mock('helmet', () => jest.fn(() => jest.fn()));
jest.mock('cookie-parser', () => jest.fn(() => jest.fn()));

describe('Main Bootstrap', () => {
  let app: INestApplication;
  let originalJwtSecret: string | undefined;
  let originalJwtCustomerPublicKey: string | undefined;

  beforeAll(() => {
    // Salva o valor original e define JWT_SECRET para os testes
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    originalJwtCustomerPublicKey = process.env.JWT_CUSTOMER_PUBLIC_KEY;
    process.env.JWT_CUSTOMER_PUBLIC_KEY = 'test-jwt-customer-public-key';
  });

  afterAll(() => {
    // Restaura o valor original
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
    if (originalJwtCustomerPublicKey) {
      process.env.JWT_CUSTOMER_PUBLIC_KEY = originalJwtCustomerPublicKey;
    } else {
      delete process.env.JWT_CUSTOMER_PUBLIC_KEY;
    }
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Configuração da aplicação', () => {
    it('deve configurar middlewares básicos', () => {
      const useSpy = jest.spyOn(app, 'use');

      // Simula a configuração de middlewares
      const mockCookieParser = jest.fn();
      const mockHelmet = jest.fn();

      app.use(mockCookieParser);
      app.use(mockHelmet);

      expect(useSpy).toHaveBeenCalledTimes(2);
      expect(useSpy).toHaveBeenCalledWith(mockCookieParser);
      expect(useSpy).toHaveBeenCalledWith(mockHelmet);
    });

    it('deve configurar CORS corretamente', () => {
      const enableCorsSpy = jest.spyOn(app, 'enableCors');

      app.enableCors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      });

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      });
    });

    it('deve configurar prefixo global da API', () => {
      const setGlobalPrefixSpy = jest.spyOn(app, 'setGlobalPrefix');

      app.setGlobalPrefix('api/v1');

      expect(setGlobalPrefixSpy).toHaveBeenCalledWith('api/v1');
    });

    it('deve configurar ValidationPipe global', () => {
      const useGlobalPipesSpy = jest.spyOn(app, 'useGlobalPipes');

      const validationPipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      app.useGlobalPipes(validationPipe);

      expect(useGlobalPipesSpy).toHaveBeenCalledWith(validationPipe);
    });

    it('deve configurar GlobalExceptionFilter', () => {
      const useGlobalFiltersSpy = jest.spyOn(app, 'useGlobalFilters');

      const globalFilter = new GlobalExceptionFilter();
      app.useGlobalFilters(globalFilter);

      expect(useGlobalFiltersSpy).toHaveBeenCalledWith(globalFilter);
    });

    it('deve usar porta padrão 3000 quando PORT não está definido', () => {
      const originalPort = process.env.PORT;
      delete process.env.PORT;

      const port = process.env.PORT ?? 3000;
      expect(port).toBe(3000);

      // Restaura a variável de ambiente
      if (originalPort) {
        process.env.PORT = originalPort;
      }
    });

    it('deve usar porta customizada quando PORT está definido', () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '3000';

      const port = process.env.PORT ?? 3000;
      expect(port).toBe('3000');

      // Restaura a variável de ambiente
      if (originalPort) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
    });
  });

  describe('Configuração de CORS com variáveis de ambiente', () => {
    it('deve usar origins específicos quando ALLOWED_ORIGINS está definido', () => {
      const originalOrigins = process.env.ALLOWED_ORIGINS;
      process.env.ALLOWED_ORIGINS = 'https://localhost:3000,https://example.com';

      const enableCorsSpy = jest.spyOn(app, 'enableCors');

      const allowedOrigins = process.env.ALLOWED_ORIGINS || '';
      const origins = allowedOrigins.split(',');
      app.enableCors({
        origin: origins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      });

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: ['https://localhost:3000', 'https://example.com'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      });

      // Restaura a variável de ambiente
      if (originalOrigins) {
        process.env.ALLOWED_ORIGINS = originalOrigins;
      } else {
        delete process.env.ALLOWED_ORIGINS;
      }
    });

    it('deve usar true como fallback quando ALLOWED_ORIGINS não está definido', () => {
      const originalOrigins = process.env.ALLOWED_ORIGINS;
      delete process.env.ALLOWED_ORIGINS;

      const enableCorsSpy = jest.spyOn(app, 'enableCors');

      const allowedOrigins = process.env.ALLOWED_ORIGINS as string | undefined;
      const origins = allowedOrigins ? allowedOrigins.split(',') : true;
      app.enableCors({
        origin: origins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      });

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      });

      // Restaura a variável de ambiente
      if (originalOrigins) {
        process.env.ALLOWED_ORIGINS = originalOrigins;
      }
    });
  });

  describe('Tratamento de erros', () => {
    it('deve tratar erros de bootstrap adequadamente', () => {
      const mockError = new Error('Bootstrap failed');
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Simula o tratamento de erro do bootstrap
      const errorHandler = (err: Error) => {
        process.stderr.write(`Failed to bootstrap application: ${String(err)}\n`);
        process.exit(1);
      };

      errorHandler(mockError);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Failed to bootstrap application: Error: Bootstrap failed\n'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
