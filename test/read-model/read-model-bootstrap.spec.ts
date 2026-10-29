import {
  ensureReadModelSchema,
  ReadModelBootstrapService,
} from '../../src/shared/infrastructure/read-model/read-model-bootstrap.service';
import type { Db, MongoClient } from 'mongodb';

function fakeDb(existing: string[]) {
  const createIndex = jest.fn().mockResolvedValue('fila_prioridade_createdAt_id');
  const db = {
    databaseName: 'os_read_model',
    listCollections: jest.fn(() => ({
      toArray: jest.fn().mockResolvedValue(existing.map((name) => ({ name }))),
    })),
    createCollection: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn(() => ({ createIndex })),
  };
  return { db, createIndex };
}

describe('ensureReadModelSchema', () => {
  it('cria as duas coleções e o índice composto da fila', async () => {
    const { db, createIndex } = fakeDb([]);

    await ensureReadModelSchema(db as unknown as Db);

    expect(db.createCollection).toHaveBeenCalledWith('os_read_model');
    expect(db.createCollection).toHaveBeenCalledWith('cliente_read_model');
    expect(db.collection).toHaveBeenCalledWith('os_read_model');
    expect(createIndex).toHaveBeenCalledWith(
      { prioridade: 1, createdAt: 1, _id: 1 },
      { name: 'fila_prioridade_createdAt_id' }
    );
  });

  it('é idempotente: não recria coleções existentes', async () => {
    const { db, createIndex } = fakeDb(['os_read_model', 'cliente_read_model']);

    await ensureReadModelSchema(db as unknown as Db);

    expect(db.createCollection).not.toHaveBeenCalled();
    expect(createIndex).toHaveBeenCalledTimes(1);
  });
});

describe('ReadModelBootstrapService', () => {
  it('conecta e garante o schema na subida, e fecha a conexão no shutdown', async () => {
    const { db } = fakeDb(['os_read_model', 'cliente_read_model']);
    const client = { connect: jest.fn().mockResolvedValue(undefined), close: jest.fn() };
    const service = new ReadModelBootstrapService(
      client as unknown as MongoClient,
      db as unknown as Db
    );

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(client.connect).toHaveBeenCalled();
    expect(db.listCollections).toHaveBeenCalled();
    expect(client.close).toHaveBeenCalled();
  });
});
