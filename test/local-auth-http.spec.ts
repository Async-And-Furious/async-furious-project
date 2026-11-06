import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
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
  AtualizarOrdemServicoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  CriarOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
  DetalharOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  ListarServicosInsumosNaOsUseCase,
  RegistrarEntregaVeiculoUseCase,
} from '../src/modules/ordem-servico/application/use-cases/ordem-servico.use-cases';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import { ConsultarTempoMedioExecucaoUseCase } from '../src/modules/ordem-servico/application/use-cases/tempo-medio-execucao.use-case';

describe('Local JWT identity and authorization over HTTP', () => {
  const issuer = 'repo-auth-serverless';
  const audience = 'async-furious-project';
  const secret = 'local-test-secret';
  const customer = { id: 'customer-1', email: 'customer@workshop.test', ativo: true };
  const staff = { id: 'staff-1', email: 'staff@workshop.test', role: 'RECEPCIONISTA' };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === staff.id ? staff : null)
      ),
    },
    cliente: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (where.id === customer.id) return Promise.resolve(customer);
        if (where.id === 'inactive-customer') return Promise.resolve({ ...customer, ativo: false });
        return Promise.resolve(null);
      }),
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

  let app: INestApplication;
  let jwtService: JwtService;
  let server: ReturnType<typeof request>;

  beforeAll(async () => {
    const config = new ConfigService({
      JWT_ALGORITHM: 'HS256',
      JWT_SECRET: secret,
      JWT_ISSUER: issuer,
      JWT_AUDIENCE: audience,
      JWT_EXPIRES_IN: '1800',
    });
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret,
          signOptions: { algorithm: 'HS256', issuer, audience, expiresIn: '1800s' },
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

  const bearer = (sub: string) => `Bearer ${jwtService.sign({ sub })}`;

  it('resolves an active customer from sub and denies staff order reads', async () => {
    await server.get('/ordens-servico').set('Authorization', bearer(customer.id)).expect(403);
  });

  it('preserves database-backed staff access', async () => {
    await server.get('/ordens-servico').set('Authorization', bearer(staff.id)).expect(200);
  });

  it('rejects inactive customers and retains authenticated customer approval', async () => {
    await server
      .patch('/ordens-servico/00000000-0000-4000-8000-000000000001/aprovar-servico')
      .set('Authorization', bearer('inactive-customer'))
      .expect(401);
    await server
      .patch('/ordens-servico/00000000-0000-4000-8000-000000000001/aprovar-servico')
      .set('Authorization', bearer(customer.id))
      .expect(200);
  });

  it('requires a JWT for approve-service', async () => {
    await server
      .patch('/ordens-servico/00000000-0000-4000-8000-000000000001/aprovar-servico')
      .expect(401);
  });
});
