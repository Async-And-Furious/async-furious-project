import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Collection, Db } from 'mongodb';
import type { Application } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { READ_MODEL_DB } from '../src/shared/infrastructure/read-model/read-model.config';
import { ReadModelFailureReporter } from '../src/shared/infrastructure/read-model/read-model-failure.reporter';
import { OsReadModelRebuilder } from '../src/modules/ordem-servico/infrastructure/read-model/os-read-model.rebuilder';
import { ClienteReadModelRebuilder } from '../src/modules/cadastro/infrastructure/read-model/cliente-read-model.rebuilder';
import { createTestUser, cleanupTestUser } from './support/fixtures';
import { randomInt } from 'node:crypto';

// Read model de OS e Cliente (#335): Postgres como fonte da verdade, write-through
// síncrono para o MongoDB (stand-in do DocumentDB no CI) e rebuild.
describe('Read model de OS e Cliente (e2e)', () => {
  const documento = '15350946056';
  const recepcionistaEmail = 'e2e-rm-recepcionista@example.com';
  const adminEmail = 'e2e-rm-admin@example.com';
  const mecanicoEmail = 'e2e-rm-mecanico@example.com';

  let app: INestApplication;
  let server: ReturnType<typeof request>;
  let prisma: PrismaService;
  let db: Db;
  let recepcionista: string;
  let admin: string;
  let mecanico: string;
  const ordens: string[] = [];
  let clienteId: string;

  async function abrirOs(descricao: string): Promise<string> {
    const response = await server
      .post('/ordens-servico')
      .set('Authorization', `Bearer ${recepcionista}`)
      .send({
        cliente: {
          nome: 'Cliente Read Model',
          email: 'e2e-rm-cliente@example.com',
          telefone: '11977776666',
          documento,
          tipoDocumento: 'CPF',
        },
        veiculo: {
          placa: `RMD${randomInt(1000, 10000)}`,
          marca: 'VW',
          modelo: 'Gol',
          ano: 2018,
          cor: 'Preto',
        },
        servicos: [],
        pecas: [],
        descricao,
      })
      .expect(201);
    const { id } = response.body as { id: string };
    ordens.push(id);
    return id;
  }

  const documentoOs = (id: string) => db.collection('os_read_model').findOne({ _id: id as never });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    server = request(app.getHttpServer() as unknown as Application);
    prisma = moduleFixture.get(PrismaService);
    db = moduleFixture.get(READ_MODEL_DB);
    const jwt = moduleFixture.get(JwtService);

    await db.collection('os_read_model').deleteMany({});
    await db.collection('cliente_read_model').deleteMany({});
    await prisma.cliente.deleteMany({ where: { documento } });

    recepcionista = (
      await createTestUser(prisma, jwt, {
        email: recepcionistaEmail,
        password: 'admin123',
        name: 'Recepcionista RM',
        role: 'RECEPCIONISTA',
      })
    ).token;
    admin = (
      await createTestUser(prisma, jwt, {
        email: adminEmail,
        password: 'admin123',
        name: 'Admin RM',
        role: 'ADMIN',
      })
    ).token;
    mecanico = (
      await createTestUser(prisma, jwt, {
        email: mecanicoEmail,
        password: 'admin123',
        name: 'Mecanico RM',
        role: 'MECANICO',
      })
    ).token;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      await prisma.ordemServico.deleteMany({ where: { id: { in: ordens } } });
      await prisma.cliente.deleteMany({ where: { documento } });
      for (const email of [recepcionistaEmail, adminEmail, mecanicoEmail]) {
        await cleanupTestUser(prisma, email);
      }
    }
    if (app) await app.close();
  });

  it('cria o documento da OS na abertura (RECEIVED) e serve as quatro leituras', async () => {
    const id = await abrirOs('Revisão completa');

    const doc = await documentoOs(id);
    expect(doc).toEqual(
      expect.objectContaining({
        _id: id,
        status: 'RECEIVED',
        prioridade: 4,
        cliente: expect.objectContaining({ nome: 'Cliente Read Model', documento }),
        veiculo: expect.objectContaining({ marca: 'VW', modelo: 'Gol' }),
      })
    );
    expect(doc).not.toHaveProperty('orcamento');
    expect(doc).not.toHaveProperty('itens');
    expect(doc).not.toHaveProperty('historico');

    const detalhe = await server
      .get(`/ordens-servico/${id}`)
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
    expect(detalhe.body).toEqual(expect.objectContaining({ id, status: 'RECEIVED' }));
    expect(detalhe.body).not.toHaveProperty('orcamento');
    clienteId = detalhe.body.clienteId;

    const status = await server.get(`/ordens-servico/${id}/status`).expect(200);
    expect(status.body).toEqual({
      ordemServicoId: id,
      status: 'RECEIVED',
      marcos: expect.objectContaining({ createdAt: expect.any(String), iniciadaEm: null }),
    });

    const fila = await server
      .get('/ordens-servico')
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
    expect(fila.body.data.map((os: { id: string }) => os.id)).toContain(id);

    const cliente = await server
      .get(`/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
    expect(cliente.body).toEqual({
      id: clienteId,
      nome: 'Cliente Read Model',
      email: 'e2e-rm-cliente@example.com',
      telefone: '11977776666',
      documento: '153.509.460-56',
      tipoDocumento: 'CPF',
    });
    expect(
      await db.collection('cliente_read_model').findOne({ _id: clienteId as never })
    ).toBeTruthy();
  });

  it('reflete cada mudança de estado e grava o histórico com motivo', async () => {
    const id = await abrirOs('Barulho no motor');

    await server
      .patch(`/ordens-servico/${id}/assumir`)
      .set('Authorization', `Bearer ${mecanico}`)
      .expect(200);
    expect((await documentoOs(id))?.status).toBe('UNDER_DIAGNOSIS');

    await server
      .patch(`/ordens-servico/${id}/servicos-insumos`)
      .set('Authorization', `Bearer ${mecanico}`)
      .send({ valor_total_servicos: 150, valor_total_pecas: 0 })
      .expect(200);
    expect((await documentoOs(id))?.status).toBe('AWAITING_APPROVAL');

    await server.patch(`/ordens-servico/${id}/orcamento/recusar`).expect(200);
    expect((await documentoOs(id))?.status).toBe('CLOSED_WITHOUT_EXECUTION');

    const historico = await prisma.historicoStatusOS.findMany({
      where: { ordem_servico_id: id },
      orderBy: { data_hora: 'asc' },
    });
    expect(historico.map((h) => [h.status_anterior, h.status_novo])).toEqual([
      [null, 'RECEIVED'],
      ['RECEIVED', 'UNDER_DIAGNOSIS'],
      ['UNDER_DIAGNOSIS', 'AWAITING_APPROVAL'],
      ['AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION'],
    ]);
    expect(historico[3].motivo).toContain('recusado pelo cliente');

    // CLOSED_WITHOUT_EXECUTION sai da fila, mas segue acessível pelo id
    const fila = await server
      .get('/ordens-servico?limit=100')
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
    expect(fila.body.data.map((os: { id: string }) => os.id)).not.toContain(id);
    await server
      .get(`/ordens-servico/${id}`)
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
  });

  it('pagina a fila por cursor', async () => {
    await abrirOs('Fila 1');
    await abrirOs('Fila 2');

    const primeira = await server
      .get('/ordens-servico?limit=1')
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
    expect(primeira.body.data).toHaveLength(1);
    expect(primeira.body.pagination.nextCursor).toEqual(expect.any(String));

    const segunda = await server
      .get(`/ordens-servico?limit=1&cursor=${primeira.body.pagination.nextCursor}`)
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(200);
    expect(segunda.body.data[0].id).not.toBe(primeira.body.data[0].id);

    await server
      .get('/ordens-servico?cursor=invalido')
      .set('Authorization', `Bearer ${recepcionista}`)
      .expect(400);
  });

  it('falha no DocumentDB não derruba o request, é relatada, e o rebuild conserta', async () => {
    const id = await abrirOs('Descrição original');
    const report = jest.spyOn(ReadModelFailureReporter.prototype, 'report');
    jest
      .spyOn(Collection.prototype, 'replaceOne')
      .mockRejectedValueOnce(new Error('DocumentDB indisponível'));

    await server
      .patch(`/ordens-servico/${id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ descricao: 'Descrição corrigida' })
      .expect(200);

    expect(report).toHaveBeenCalledWith('os_read_model', id, expect.any(Error));
    expect((await prisma.ordemServico.findUnique({ where: { id } }))?.descricao).toBe(
      'Descrição corrigida'
    );
    expect((await documentoOs(id))?.descricao).toBe('Descrição original');

    const rebuilders = [
      new ClienteReadModelRebuilder(prisma, db),
      new OsReadModelRebuilder(prisma, db),
    ];
    for (const rebuilder of rebuilders) await rebuilder.rebuild();

    expect((await documentoOs(id))?.descricao).toBe('Descrição corrigida');
  });
});
