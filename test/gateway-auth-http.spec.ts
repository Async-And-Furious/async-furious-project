import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { generateKeyPairSync } from 'node:crypto';
import request from 'supertest';
import type { Application } from 'express';
import { AuthService } from '../src/auth/services/auth.service';
import { GlobalExceptionFilter } from '../src/shared/infrastructure/filters/global-exception.filter';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { OrdemServicoController } from '../src/modules/ordem-servico/presentation/controllers/ordem-servico.controller';
import {
  AprovarServicoPrestadoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  CriarOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
  DetalharOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  ListarServicosInsumosNaOsUseCase,
  RegistrarEntregaVeiculoUseCase,
  AtualizarOrdemServicoUseCase,
} from '../src/modules/ordem-servico/application/use-cases/ordem-servico.use-cases';
import { ConsultarTempoMedioExecucaoUseCase } from '../src/modules/ordem-servico/application/use-cases/tempo-medio-execucao.use-case';

describe('Gateway JWT authorization over HTTP', () => {
  const issuer = 'auth-lambda';
  const audience = 'async-furious-project';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const { privateKey: otherPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherPrivatePem = otherPrivateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const logger = { error: jest.fn(), warn: jest.fn() };

  let app: INestApplication;
  let jwtService: JwtService;
  let server: ReturnType<typeof request>;

  const staff = { id: 'staff-1', email: 'staff@workshop.test', role: 'RECEPCIONISTA' };
  const customer = { id: 'customer-1', email: 'customer@workshop.test', ativo: true };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (where.id === 'collision-active' || where.id === 'collision-inactive') {
          return Promise.resolve({ ...staff, id: where.id, role: 'RECEPCIONISTA' });
        }
        if (!where.id.startsWith('staff-')) return Promise.resolve(null);
        const role = where.id === staff.id ? staff.role : where.id.slice('staff-'.length);
        return Promise.resolve({ ...staff, id: where.id, role });
      }),
    },
    cliente: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (where.id === customer.id) return Promise.resolve(customer);
        if (where.id === 'inactive-customer') return Promise.resolve({ ...customer, ativo: false });
        if (where.id === 'collision-active') return Promise.resolve({ ...customer, id: where.id });
        if (where.id === 'collision-inactive') {
          return Promise.resolve({ ...customer, id: where.id, ativo: false });
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === customer.id ? customer : null)
      ),
    },
  };

  const useCases = [
    CriarOrdemServicoUseCase,
    ListarServicosInsumosNaOsUseCase,
    AtualizarOrdemServicoUseCase,
    AprovarServicoPrestadoUseCase,
    RegistrarEntregaVeiculoUseCase,
    ConsultarStatusOrdemServicoUseCase,
    ListarOrdensServicoUseCase,
    DetalharOrdemServicoUseCase,
    DeletarOrdemServicoUseCase,
    ConsultarTempoMedioExecucaoUseCase,
  ];

  beforeAll(async () => {
    const config = new ConfigService({
      AUTH_MODE: 'gateway',
      JWT_ALGORITHM: 'RS256',
      JWT_PUBLIC_KEY: publicPem,
      JWT_PRIVATE_KEY: privatePem,
      JWT_ISSUER: issuer,
      JWT_AUDIENCE: audience,
      JWT_EXPIRES_IN: '1800',
    });
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          privateKey: privatePem,
          signOptions: { algorithm: 'RS256', issuer, audience, expiresIn: '1800s' },
        }),
      ],
      controllers: [OrdemServicoController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        ...useCases.map((provide) => ({
          provide,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        })),
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter(logger as unknown as PinoLogger));
    await app.init();
    jwtService = module.get<JwtService>(JwtService);
    server = request(app.getHttpServer() as unknown as Application);
  });

  afterAll(async () => {
    await app.close();
  });

  const token = (claims: Record<string, unknown>) => jwtService.sign(claims);

  beforeEach(() => logger.error.mockClear());

  it.each([
    ['customer subject only', { sub: customer.id }],
    ['customer with forged ADMIN claims', { sub: customer.id, role: 'ADMIN', email: staff.email }],
    [
      'customer with forged RECEPCIONISTA claims',
      { sub: customer.id, role: 'RECEPCIONISTA', email: staff.email },
    ],
    [
      'customer with forged MECANICO claims',
      { sub: customer.id, role: 'MECANICO', email: staff.email },
    ],
  ])('%s is denied staff-only order reads', async (_name, claims) => {
    const bearer = `Bearer ${token(claims)}`;
    await server.get('/ordens-servico').set('Authorization', bearer).expect(403);
    await server
      .get('/ordens-servico/00000000-0000-4000-8000-000000000001')
      .set('Authorization', bearer)
      .expect(403);
  });

  // #360: o token da Lambda authenticate-customer (só `sub`, sem `role`) era mapeado para
  // RECEPCIONISTA. Também com claims de staff forjadas, o cliente recebe 403 nas rotas de staff.
  const OS_ID = '00000000-0000-4000-8000-000000000001';
  const rotasDeStaff: Array<[string, (bearer: string) => request.Test]> = [
    [
      'POST /ordens-servico (RECEPCIONISTA)',
      (bearer) => server.post('/ordens-servico').set('Authorization', bearer).send({}),
    ],
    [
      'PATCH /ordens-servico/:id/registrar-entrega (RECEPCIONISTA)',
      (bearer) =>
        server.patch(`/ordens-servico/${OS_ID}/registrar-entrega`).set('Authorization', bearer),
    ],
    [
      'PATCH /ordens-servico/:id (ADMIN)',
      (bearer) => server.patch(`/ordens-servico/${OS_ID}`).set('Authorization', bearer).send({}),
    ],
    [
      'DELETE /ordens-servico/:id (ADMIN)',
      (bearer) => server.delete(`/ordens-servico/${OS_ID}`).set('Authorization', bearer),
    ],
    [
      'GET /ordens-servico/tempo-medio (ADMIN)',
      (bearer) => server.get('/ordens-servico/tempo-medio').set('Authorization', bearer),
    ],
    [
      'PATCH /ordens-servico/:id/servicos-insumos (MECANICO)',
      (bearer) =>
        server
          .patch(`/ordens-servico/${OS_ID}/servicos-insumos`)
          .set('Authorization', bearer)
          .send({}),
    ],
  ];

  it.each(rotasDeStaff)('customer token is denied %s', async (_rota, chamar) => {
    await chamar(`Bearer ${token({ sub: customer.id })}`).expect(403);
    await chamar(
      `Bearer ${token({ sub: customer.id, role: 'RECEPCIONISTA', email: staff.email })}`
    ).expect(403);
  });

  it('preserves database-backed staff access despite token role claims', async () => {
    const bearer = `Bearer ${token({ sub: staff.id, role: 'ADMIN', email: 'forged@invalid.test' })}`;
    await server.get('/ordens-servico').set('Authorization', bearer).expect(200);
    await server
      .get('/ordens-servico/00000000-0000-4000-8000-000000000001')
      .set('Authorization', bearer)
      .expect(200);
    await server.get('/ordens-servico/tempo-medio').set('Authorization', bearer).expect(403);
  });

  it.each(['ADMIN', 'RECEPCIONISTA', 'MECANICO'])(
    'allows database-backed %s order reads',
    async (role) => {
      const staffId = `staff-${role}`;
      const bearer = `Bearer ${token({ sub: staffId, role: 'CLIENTE', email: 'forged@invalid.test' })}`;
      await server.get('/ordens-servico').set('Authorization', bearer).expect(200);
      await server
        .get('/ordens-servico/00000000-0000-4000-8000-000000000001')
        .set('Authorization', bearer)
        .expect(200);
    }
  );

  it('keeps order status public and the removed tracking alias returns 404', async () => {
    await server.get('/ordens-servico/00000000-0000-4000-8000-000000000001/status').expect(200);
    await server
      .get('/ordens-servico/00000000-0000-4000-8000-000000000001/rastreamento')
      .expect(404);
  });

  it.each(['missing-customer', 'inactive-customer'])('%s cannot authenticate', async (sub) => {
    await server
      .get('/ordens-servico')
      .set('Authorization', `Bearer ${token({ sub })}`)
      .expect(401);
  });

  it('rejects a token signed by a different key', async () => {
    const invalid = jwtService.sign(
      { sub: customer.id },
      { privateKey: otherPrivatePem, algorithm: 'RS256', issuer, audience }
    );
    await server.get('/ordens-servico').set('Authorization', `Bearer ${invalid}`).expect(401);
  });

  it.each([
    ['wrong issuer', { issuer: 'wrong-issuer' }],
    ['wrong audience', { audience: 'wrong-audience' }],
    ['expired', { expiresIn: '-1s' }],
  ])('rejects a token with %s', async (_name, options) => {
    const invalid = jwtService.sign(
      { sub: customer.id },
      { ...options, privateKey: privatePem, algorithm: 'RS256' }
    );
    await server.get('/ordens-servico').set('Authorization', `Bearer ${invalid}`).expect(401);
  });

  it('keeps approve-service authenticated without requiring a staff role', async () => {
    await server
      .patch('/ordens-servico/00000000-0000-4000-8000-000000000001/aprovar-servico')
      .set('Authorization', `Bearer ${token({ sub: customer.id })}`)
      .expect(200);
    await server
      .patch('/ordens-servico/00000000-0000-4000-8000-000000000001/aprovar-servico')
      .expect(401);
  });

  it.each(['collision-active', 'collision-inactive'])(
    'rejects colliding User/Cliente subject %s regardless of customer state',
    async (sub) => {
      await server
        .get('/ordens-servico')
        .set('Authorization', `Bearer ${token({ sub, role: 'RECEPCIONISTA', email: staff.email })}`)
        .expect(401);
    }
  );

  it('returns a sanitized 500 and structured operational signal when User lookup fails', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('database unavailable'));
    await server
      .get('/ordens-servico')
      .set('Authorization', `Bearer ${token({ sub: customer.id })}`)
      .expect(500)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 500,
          message: 'Internal server error',
          error: 'Internal Server Error',
        });
        expect(JSON.stringify(body)).not.toContain(customer.id);
        expect(JSON.stringify(body)).not.toContain('database unavailable');
      });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          name: 'IdentityLookupError',
          message: 'Identity lookup failed',
        }),
        statusCode: 500,
      }),
      'Unhandled exception: Internal Server Error'
    );
    const loggedError = logger.error.mock.calls[0][0].err as Error;
    expect(loggedError.stack).not.toContain(customer.id);
    expect(loggedError.stack).not.toContain('database unavailable');
  });

  it('returns a sanitized 500 and logs no raw details when Cliente lookup fails', async () => {
    prisma.cliente.findUnique.mockRejectedValueOnce(new Error('database unavailable'));
    await server
      .get('/ordens-servico')
      .set('Authorization', `Bearer ${token({ sub: customer.id })}`)
      .expect(500)
      .expect(({ body }) => {
        expect(body).toMatchObject({ statusCode: 500, message: 'Internal server error' });
        expect(JSON.stringify(body)).not.toContain(customer.id);
        expect(JSON.stringify(body)).not.toContain('database unavailable');
      });
    const loggedError = logger.error.mock.calls[0][0].err as Error;
    expect(loggedError.name).toBe('IdentityLookupError');
    expect(loggedError.stack).not.toContain(customer.id);
    expect(loggedError.stack).not.toContain('database unavailable');
  });
});
