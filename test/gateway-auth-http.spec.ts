import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { generateKeyPairSync } from 'node:crypto';
import request from 'supertest';
import type { Application } from 'express';
import { AuthService } from '../src/auth/services/auth.service';
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
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import { ConsultarTempoMedioExecucaoUseCase } from '../src/modules/ordem-servico/application/use-cases/tempo-medio-execucao.use-case';

describe('Gateway JWT authorization over HTTP', () => {
  const issuer = 'auth-lambda';
  const audience = 'async-furious-project';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const { privateKey: otherPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherPrivatePem = otherPrivateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

  let app: INestApplication;
  let jwtService: JwtService;
  let server: ReturnType<typeof request>;

  const staff = { id: 'staff-1', email: 'staff@workshop.test', role: 'RECEPCIONISTA' };
  const customer = { id: 'customer-1', email: 'customer@workshop.test', ativo: true };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (!where.id.startsWith('staff-')) return Promise.resolve(null);
        const role = where.id === staff.id ? staff.role : where.id.slice('staff-'.length);
        return Promise.resolve({ ...staff, id: where.id, role });
      }),
    },
    cliente: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (where.id === customer.id) return Promise.resolve(customer);
        if (where.id === 'inactive-customer') return Promise.resolve({ ...customer, ativo: false });
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
    AprovarOrcamentoUseCase,
    RecusarOrcamentoUseCase,
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
    await app.init();
    jwtService = module.get<JwtService>(JwtService);
    server = request(app.getHttpServer() as unknown as Application);
  });

  afterAll(async () => {
    await app.close();
  });

  const token = (claims: Record<string, unknown>) => jwtService.sign(claims);

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

  it('keeps order status and tracking public', async () => {
    await server.get('/ordens-servico/00000000-0000-4000-8000-000000000001/status').expect(200);
    await server
      .get('/ordens-servico/00000000-0000-4000-8000-000000000001/rastreamento')
      .expect(200);
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
  });
});
