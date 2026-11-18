import { MongoClient } from 'mongodb';
import { OsReadModelQuery } from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.query';
import { buildOsReadModelDocument } from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.document';
import { ensureReadModelSchema } from '../../src/shared/infrastructure/read-model/read-model-bootstrap.service';
import {
  FILA_PRIORIDADE_INDEX,
  OS_READ_MODEL_COLLECTION,
} from '../../src/shared/infrastructure/read-model/read-model.config';
import type { Db } from 'mongodb';

// Roda contra o container mongo do CI (MONGODB_TEST_URI); sem ele, é pulado.
// O DocumentDB real (compatível por API) é validado em HML.
const uri = process.env.MONGODB_TEST_URI;
const describeMongo = uri ? describe : describe.skip;

function os(id: string, status: string, createdAt: string) {
  const created = new Date(createdAt);
  return buildOsReadModelDocument({
    id,
    status,
    descricao: null,
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    created_at: created,
    updated_at: created,
    cliente: { id: 'cli-1', nome: 'Maria', documento: '52998224725' },
    veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
  });
}

describeMongo('OsReadModelQuery contra MongoDB (integração)', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    client = await MongoClient.connect(uri as string);
    db = client.db(`os_read_model_it_${process.pid}`);
    await ensureReadModelSchema(db);
    await ensureReadModelSchema(db); // idempotente
    await db
      .collection(OS_READ_MODEL_COLLECTION)
      .insertMany([
        os('os-recebida-nova', 'RECEIVED', '2026-01-03T00:00:00Z'),
        os('os-execucao', 'IN_PROGRESS', '2026-01-05T00:00:00Z'),
        os('os-recebida-antiga', 'RECEIVED', '2026-01-01T00:00:00Z'),
        os('os-aguardando-aprovacao', 'AWAITING_APPROVAL', '2026-01-04T00:00:00Z'),
        os('os-finalizada', 'FINISHED', '2026-01-01T00:00:00Z'),
        os('os-entregue', 'DELIVERED', '2026-01-01T00:00:00Z'),
        os('os-encerrada', 'CLOSED_WITHOUT_EXECUTION', '2026-01-01T00:00:00Z'),
      ] as never[]);
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it('cria o índice composto da fila', async () => {
    const indexes = await db.collection(OS_READ_MODEL_COLLECTION).indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: FILA_PRIORIDADE_INDEX,
          key: { prioridade: 1, createdAt: 1, _id: 1 },
        }),
      ])
    );
  });

  it('pagina a fila por cursor, por prioridade e antiguidade, sem as OS encerradas', async () => {
    const query = new OsReadModelQuery(db);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const pagina = await query.listarFila(2, cursor);
      ids.push(...pagina.data.map((item) => item.id));
      cursor = pagina.pagination.nextCursor ?? undefined;
    } while (cursor);

    expect(ids).toEqual([
      'os-execucao',
      'os-aguardando-aprovacao',
      'os-recebida-antiga',
      'os-recebida-nova',
    ]);
  });

  it('a consulta da fila usa o índice composto (explain)', async () => {
    const plan = (await db
      .collection(OS_READ_MODEL_COLLECTION)
      .find({ status: { $nin: ['FINISHED', 'DELIVERED', 'CLOSED_WITHOUT_EXECUTION'] } })
      .sort({ prioridade: 1, createdAt: 1, _id: 1 })
      .limit(3)
      .explain()) as { queryPlanner: { winningPlan: unknown } };

    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain(FILA_PRIORIDADE_INDEX);
  });
});
