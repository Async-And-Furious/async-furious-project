import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Application } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { createTestUser, cleanupTestUser } from './support/fixtures';
import { randomInt } from 'node:crypto';

// Superfície HTTP do OS Service (#332): rota pública mínima, rotas removidas
// e webhook de status como canal de exceção.
describe('OrdemServico superfície HTTP (e2e)', () => {
  const webhookSecret = 'e2e-webhook-secret';
  const recepcionistaEmail = 'e2e-superficie-recepcionista@example.com';
  const clienteDocumento = '52998224725';

  let app: INestApplication;
  let server: ReturnType<typeof request>;
  let prismaService: PrismaService;
  let recepcionistaToken: string;
  let ordemServicoId: string;
  let originalWebhookSecret: string | undefined;

  beforeAll(async () => {
    originalWebhookSecret = process.env.WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    server = request(app.getHttpServer() as unknown as Application);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    const jwtService = moduleFixture.get<JwtService>(JwtService);

    await prismaService.cliente.deleteMany({ where: { documento: clienteDocumento } });

    const recepcionista = await createTestUser(prismaService, jwtService, {
      email: recepcionistaEmail,
      password: 'admin123',
      name: 'Recepcionista Superficie E2E',
      role: 'RECEPCIONISTA',
    });
    recepcionistaToken = recepcionista.token;

    const osResponse = await server
      .post('/ordens-servico')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({
        cliente: {
          nome: 'Cliente Superficie',
          email: 'e2e-superficie-cliente@example.com',
          telefone: '11988887777',
          documento: clienteDocumento,
          tipoDocumento: 'CPF',
        },
        veiculo: {
          placa: `SUP${randomInt(1000, 10000)}`,
          marca: 'Fiat',
          modelo: 'Uno',
          ano: 2015,
          cor: 'Branco',
        },
        servicos: [],
        pecas: [],
        descricao: 'Barulho na suspensao',
      })
      .expect(201);
    ordemServicoId = osResponse.body.id;
  });

  afterAll(async () => {
    if (prismaService) {
      if (ordemServicoId) {
        await prismaService.ordemServico.deleteMany({ where: { id: ordemServicoId } });
      }
      const cliente = await prismaService.cliente.findFirst({
        where: { documento: clienteDocumento },
      });
      if (cliente) {
        await prismaService.veiculo.deleteMany({ where: { id_cliente: cliente.id } });
        await prismaService.cliente.deleteMany({ where: { id: cliente.id } });
      }
      await cleanupTestUser(prismaService, recepcionistaEmail);
    }
    if (app) await app.close();

    if (originalWebhookSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = originalWebhookSecret;
  });

  it('GET /ordens-servico/:id/status responde sem Bearer, com resposta mínima', async () => {
    const response = await server.get(`/ordens-servico/${ordemServicoId}/status`).expect(200);

    expect(response.body).toEqual({
      ordemServicoId,
      status: 'RECEIVED',
      marcos: {
        createdAt: expect.any(String),
        iniciadaEm: null,
        finalizadaEm: null,
        entregueEm: null,
      },
    });
    expect(response.body).not.toHaveProperty('cliente');
  });

  it('GET /ordens-servico sem Bearer responde 401', async () => {
    await server.get('/ordens-servico').expect(401);
  });

  it('GET /ordens-servico/:id/rastreamento foi removida (404)', async () => {
    await server
      .get(`/ordens-servico/${ordemServicoId}/rastreamento`)
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .expect(404);
  });

  it('POST /ordens-servico/:id/aprovar-servico foi removida (404)', async () => {
    await server
      .post(`/ordens-servico/${ordemServicoId}/aprovar-servico`)
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({ decisao: 'APROVADO' })
      .expect(404);
  });

  it('PATCH /ordens-servico/:id/aprovar-servico continua exigindo JWT', async () => {
    await server.patch(`/ordens-servico/${ordemServicoId}/aprovar-servico`).expect(401);
  });

  it('webhook de status sem x-webhook-secret responde 401', async () => {
    await server
      .post('/webhooks/service-orders/status')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({ osId: ordemServicoId, status: 'UNDER_DIAGNOSIS' })
      .expect(401);
  });

  it('webhook de status rejeita a transição para DELIVERED (400) sem alterar a OS', async () => {
    await server
      .post('/webhooks/service-orders/status')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .set('x-webhook-secret', webhookSecret)
      .send({ osId: ordemServicoId, status: 'DELIVERED' })
      .expect(400);

    const os = await prismaService.ordemServico.findUnique({ where: { id: ordemServicoId } });
    expect(os?.status).toBe('RECEIVED');
  });

  it('webhook de status aplica uma transição válida pela máquina de estados', async () => {
    await server
      .post('/webhooks/service-orders/status')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .set('x-webhook-secret', webhookSecret)
      .send({ osId: ordemServicoId, status: 'UNDER_DIAGNOSIS', motivo: 'Reprocesso manual' })
      .expect(200);

    const response = await server.get(`/ordens-servico/${ordemServicoId}/status`).expect(200);
    expect(response.body.status).toBe('UNDER_DIAGNOSIS');
  });
});
