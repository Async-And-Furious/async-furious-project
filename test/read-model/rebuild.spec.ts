import { rebuildCollection } from '../../src/shared/infrastructure/read-model/rebuild-collection';
import { OsReadModelRebuilder } from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.rebuilder';
import { ClienteReadModelRebuilder } from '../../src/modules/cadastro/infrastructure/read-model/cliente-read-model.rebuilder';
import type { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import type { Collection, Db } from 'mongodb';

function fakeCollection(name: string) {
  return {
    collectionName: name,
    bulkWrite: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
  };
}

async function* paginas<T>(...pages: T[][]): AsyncGenerator<T[]> {
  for (const page of pages) yield await Promise.resolve(page);
}

describe('rebuildCollection', () => {
  it('grava em lote com replaceOne + upsert e remove os órfãos', async () => {
    const collection = fakeCollection('os_read_model');

    const result = await rebuildCollection(
      collection as unknown as Collection<{ _id: string; v: number }>,
      paginas([{ _id: 'a', v: 1 }], [], [{ _id: 'b', v: 2 }])
    );

    expect(collection.bulkWrite).toHaveBeenCalledTimes(2);
    expect(collection.bulkWrite).toHaveBeenNthCalledWith(
      1,
      [{ replaceOne: { filter: { _id: 'a' }, replacement: { _id: 'a', v: 1 }, upsert: true } }],
      { ordered: false }
    );
    expect(collection.deleteMany).toHaveBeenCalledWith({ _id: { $nin: ['a', 'b'] } });
    expect(result).toEqual({ collection: 'os_read_model', upserted: 2, removed: 2 });
  });
});

describe('rebuilders', () => {
  const os = {
    id: 'os-1',
    status: 'RECEIVED',
    descricao: null,
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    cliente: { id: 'cli-1', nome: 'Maria', documento: '52998224725' },
    veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
  };

  it('OsReadModelRebuilder pagina o Postgres por id e usa o builder do write-through', async () => {
    const collection = fakeCollection('os_read_model');
    const findMany = jest.fn().mockResolvedValueOnce([os]).mockResolvedValueOnce([]);
    const rebuilder = new OsReadModelRebuilder(
      { ordemServico: { findMany } } as unknown as PrismaService,
      { collection: jest.fn(() => collection) } as unknown as Db
    );

    const result = await rebuilder.rebuild();

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 500, orderBy: { id: 'asc' } })
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: { id: 'os-1' }, skip: 1 })
    );
    const [ops] = collection.bulkWrite.mock.calls[0] as [
      Array<{ replaceOne: { replacement: unknown } }>,
    ];
    expect(ops[0].replaceOne.replacement).toEqual(
      expect.objectContaining({ _id: 'os-1', prioridade: 4, status: 'RECEIVED' })
    );
    expect(result.upserted).toBe(1);
  });

  it('ClienteReadModelRebuilder reconstrói a coleção de clientes', async () => {
    const collection = fakeCollection('cliente_read_model');
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'cli-1',
          nome: 'Maria',
          email: 'maria@example.com',
          telefone: null,
          documento: '52998224725',
          tipo_documento: 'CPF',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
      .mockResolvedValueOnce([]);
    const rebuilder = new ClienteReadModelRebuilder(
      { cliente: { findMany } } as unknown as PrismaService,
      { collection: jest.fn(() => collection) } as unknown as Db
    );

    const result = await rebuilder.rebuild();

    expect(result).toEqual({ collection: 'cliente_read_model', upserted: 1, removed: 2 });
    const [ops] = collection.bulkWrite.mock.calls[0] as [
      Array<{ replaceOne: { replacement: unknown } }>,
    ];
    expect(ops[0].replaceOne.replacement).toEqual(
      expect.objectContaining({ _id: 'cli-1', documento: '529.982.247-25' })
    );
  });
});
