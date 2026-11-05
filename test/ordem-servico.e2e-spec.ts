import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Application } from 'express';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { GATEWAY_PAGAMENTO } from '../src/modules/financeiro/domain/interfaces/pagamento.interface';
import { DiagnosticoIniciado } from '../src/modules/ordem-servico/domain/events/diagnostico-iniciado.event';
import { ExecucaoIniciada } from '../src/modules/ordem-servico/domain/events/execucao-iniciada.event';
import { ExecucaoConcluida } from '../src/modules/ordem-servico/domain/events/execucao-concluida.event';
import { createTestUser, cleanupTestUser } from './support/fixtures';
import { randomInt } from 'node:crypto';

describe('OrdemServico Happy Flow (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<typeof request>;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let eventEmitter: EventEmitter2;

  let recepcionistaToken: string;
  let mecanicoToken: string;

  let clienteId: string;
  let veiculoId: string;
  let ordemServicoId: string;

  const recepcionistaEmail = 'e2e-os-recepcionista@example.com';
  const adminEmail = 'e2e-os-admin@example.com';
  const mecanicoEmail = 'e2e-os-mecanico@example.com';
  const clienteDocumento = '39053344705';
  const clienteEmail = 'e2e-os-cliente@example.com';

  beforeAll(async () => {
    // O Mercado Pago é externo: no e2e a cobrança usa um gateway falso.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GATEWAY_PAGAMENTO)
      .useValue({
        criarCobranca: jest.fn((ordemServicoId: string) =>
          Promise.resolve({
            preferenceId: `pref-e2e-${ordemServicoId}`,
            linkPagamento: `https://mp.test/checkout/${ordemServicoId}`,
          })
        ),
        consultarPagamento: jest.fn().mockResolvedValue(null),
      })
      .compile();

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
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    eventEmitter = app.get(EventEmitter2);

    await prismaService.ordemServico.deleteMany({});
    await prismaService.veiculo.deleteMany({});
    await prismaService.cliente.deleteMany({ where: { documento: clienteDocumento } });

    const recepcionista = await createTestUser(prismaService, jwtService, {
      email: recepcionistaEmail,
      password: 'admin123',
      name: 'Recepcionista E2E',
      role: 'RECEPCIONISTA',
    });

    const mecanico = await createTestUser(prismaService, jwtService, {
      email: mecanicoEmail,
      password: 'admin123',
      name: 'Mecanico E2E',
      role: 'MECANICO',
    });

    recepcionistaToken = recepcionista.token;
    mecanicoToken = mecanico.token;
  });

  afterAll(async () => {
    if (!prismaService) {
      if (app) {
        await app.close();
      }
      return;
    }

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
    await cleanupTestUser(prismaService, mecanicoEmail);
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

    const uniquePlaca = `OSF${randomInt(1000, 10000)}`;

    const veiculoResponse = await server
      .post('/veiculos')
      .set('Authorization', `Bearer ${recepcionistaToken}`)
      .send({
        placa: uniquePlaca,
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
        cliente: {
          nome: 'Cliente Fluxo OS',
          email: clienteEmail,
          telefone: '11999999999',
          documento: clienteDocumento,
          tipoDocumento: 'CPF',
        },
        veiculo: {
          placa: uniquePlaca,
          marca: 'Honda',
          modelo: 'Fit',
          ano: 2021,
          cor: 'Prata',
        },
        servicos: [],
        pecas: [],
        descricao: 'Revisao geral e troca de oleo',
      })
      .expect(201);

    ordemServicoId = osResponse.body.id;

    const statusDaOs = async (): Promise<string> => {
      const resposta = await server
        .get(`/ordens-servico/${ordemServicoId}/status`)
        .set('Authorization', `Bearer ${recepcionistaToken}`)
        .expect(200);
      return resposta.body.status as string;
    };

    // Os eventos do Execução e Produção são injetados in-process (EventEmitter2), no lugar do
    // serviço real, que não sobe neste teste. Por isso o fluxo do mecânico não chama mais
    // assumir/analisar/finalizar-execucao: essas rotas saíram do OS Service (ver
    // test/ordem-servico/controllers/ordem-servico.controller.spec.ts, "rotas migradas").

    // Sem DiagnosticoIniciado a OS segue RECEIVED e servicos-insumos responde erro de estado.
    await server
      .patch(`/ordens-servico/${ordemServicoId}/servicos-insumos`)
      .set('Authorization', `Bearer ${mecanicoToken}`)
      .send({ valor_total_servicos: 300, valor_total_pecas: 0 })
      .expect(400);

    await eventEmitter.emitAsync('DiagnosticoIniciado', new DiagnosticoIniciado(ordemServicoId));
    expect(await statusDaOs()).toBe('UNDER_DIAGNOSIS');

    // A resposta devolve só os totais; o Orcamento passa a ser do Billing (OrcamentoCalculado).
    const totais = await server
      .patch(`/ordens-servico/${ordemServicoId}/servicos-insumos`)
      .set('Authorization', `Bearer ${mecanicoToken}`)
      .send({
        valor_total_servicos: 300,
        valor_total_pecas: 0,
      })
      .expect(200);
    expect(totais.body).toEqual({
      ordemServicoId,
      valorTotalServicos: 300,
      valorTotalPecas: 0,
      valorTotalGeral: 300,
    });
    expect(await statusDaOs()).toBe('AWAITING_APPROVAL');

    const aprovacao = await server
      .patch(`/ordens-servico/${ordemServicoId}/orcamento/aprovar`)
      .expect(200);
    expect(aprovacao.body.linkPagamento).toBe(`https://mp.test/checkout/${ordemServicoId}`);
    // Aprovar/reservar peças não leva mais a OS a IN_PROGRESS: só ExecucaoIniciada.
    expect(await statusDaOs()).toBe('AWAITING_APPROVAL');

    await eventEmitter.emitAsync('ExecucaoIniciada', new ExecucaoIniciada(ordemServicoId));
    expect(await statusDaOs()).toBe('IN_PROGRESS');

    // A conclusão vem do Execução (PATCH /execucoes/{id}/concluir -> ExecucaoConcluida).
    await eventEmitter.emitAsync('ExecucaoConcluida', new ExecucaoConcluida(ordemServicoId));
    expect(await statusDaOs()).toBe('FINISHED');

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
