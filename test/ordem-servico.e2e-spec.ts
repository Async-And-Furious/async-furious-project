import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Application } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { createTestUser, cleanupTestUser } from './support/fixtures';

type PrismaDeleteManyArgs = { where?: Record<string, unknown> };

type PrismaTestClient = {
  ordemServico: { deleteMany(args: PrismaDeleteManyArgs): Promise<unknown> };
  veiculo: { deleteMany(args: PrismaDeleteManyArgs): Promise<unknown> };
  cliente: { deleteMany(args: PrismaDeleteManyArgs): Promise<unknown> };
};

describe('OrdemServico Happy Flow (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<typeof request>;
  let prismaService: PrismaTestClient;
  let jwtService: JwtService;

  let recepcionistaToken: string;
  let adminToken: string;

  let clienteId: string;
  let veiculoId: string;
  let ordemServicoId: string;

  const recepcionistaEmail = 'e2e-os-recepcionista@example.com';
  const adminEmail = 'e2e-os-admin@example.com';
  const clienteDocumento = '39053344705';
  const clienteEmail = 'e2e-os-cliente@example.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    await app.init();

    server = request(app.getHttpServer() as unknown as Application);
    prismaService = moduleFixture.get<PrismaService>(PrismaService) as unknown as PrismaTestClient;
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await prismaService.ordemServico.deleteMany({});
    await prismaService.veiculo.deleteMany({});
    await prismaService.cliente.deleteMany({ where: { documento: clienteDocumento } });

    const recepcionista = await createTestUser(prismaService, jwtService, {
      email: recepcionistaEmail,
      password: 'admin123',
      name: 'Recepcionista E2E',
      role: 'RECEPCIONISTA',
    });

    const admin = await createTestUser(prismaService, jwtService, {
      email: adminEmail,
      password: 'admin123',
      name: 'Admin E2E',
      role: 'ADMIN',
    });

    recepcionistaToken = recepcionista.token;
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (ordemServicoId) {
      await prismaService.ordemServico.deleteMany({ where: { id: ordemServicoId } });
    }

    if (veiculoId) {
      await prismaService.veiculo.deleteMany({ where: { id: veiculoId } });
    }

    if (clienteId) {
      await prismaService.cliente.deleteMany({ where: { id: clienteId } });
    }

    await cleanupTestUser(prismaService, recepcionistaEmail);
    await cleanupTestUser(prismaService, adminEmail);
    await app.close();
  });

  it('deve percorrer o fluxo feliz da OS ate DELIVERED', async () => {
    const clienteResponse = await server
      .post('/clientes')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({
        nome: 'Cliente Fluxo OS',
        email: clienteEmail,
        telefone: '11999999999',
        documento: clienteDocumento,
        tipoDocumento: 'CPF',
      })
      .expect(201);

    clienteId = clienteResponse.body.id;

    const veiculoResponse = await server
      .post('/veiculos')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({
        placa: 'OSF1234',
        marca: 'Honda',
        modelo: 'Fit',
        ano: 2021,
        cor: 'Prata',
        clienteId,
      })
      .expect(201);

    veiculoId = veiculoResponse.body.id;

    const osResponse = await server
      .post('/ordens-servico')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({
        veiculoId,
        clienteId,
        descricao: 'Revisao geral e troca de oleo',
      })
      .expect(201);

    ordemServicoId = osResponse.body.id;

    await server
      .patch(`/ordens-servico/${ordemServicoId}/assumir`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await server
      .patch(`/ordens-servico/${ordemServicoId}/analisar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await server
      .patch(`/ordens-servico/${ordemServicoId}/servicos-insumos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        valor_total_servicos: 300,
        valor_total_pecas: 0,
      })
      .expect(200);

    await server.patch(`/ordens-servico/${ordemServicoId}/orcamento/aprovar`).expect(200);

    await server
      .patch(`/ordens-servico/${ordemServicoId}/finalizar-execucao`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await server
      .patch(`/ordens-servico/${ordemServicoId}/aprovar-servico`)
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .expect(200);

    await server
      .patch(`/ordens-servico/${ordemServicoId}/registrar-entrega`)
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .expect(200);

    const statusResponse = await server
      .get(`/ordens-servico/${ordemServicoId}/status`)
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .expect(200);

    expect(statusResponse.body).toEqual({
      ordemServicoId,
      status: 'DELIVERED',
    });
  });
});
