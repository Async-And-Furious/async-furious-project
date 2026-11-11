import { MongoBulkWriteError } from 'mongodb';
import { rebuildCollection } from '../../src/shared/infrastructure/read-model/rebuild-collection';
import { OsReadModelRebuilder } from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.rebuilder';
import { ClienteReadModelRebuilder } from '../../src/modules/cadastro/infrastructure/read-model/cliente-read-model.rebuilder';
import type { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import type { Collection, Db } from 'mongodb';

function fakeCollection(name: string, idsNaColecao: string[] = []) {
  return {
    collectionName: name,
    bulkWrite: jest.fn().mockResolvedValue({}),
    deleteMany: jest
      .fn()
      .mockImplementation((filtro: { _id: { $in: string[] } }) =>
        Promise.resolve({ deletedCount: filtro._id.$in.length })
      ),
    find: jest.fn(() => idsNaColecao.map((_id) => ({ _id }))),
  };
}

async function* paginas<T>(...pages: T[][]): AsyncGenerator<T[]> {
  for (const page of pages) yield await Promise.resolve(page);
}

const existentesEm =
  (...ids: string[]) =>
  (consulta: string[]): Promise<Set<string>> =>
    Promise.resolve(new Set(consulta.filter((id) => ids.includes(id))));

type Doc = { _id: string; v: number; updatedAt?: Date };

describe('rebuildCollection', () => {
  it('grava em lote com replaceOne + upsert e remove só ids que não existem mais no Postgres', async () => {
    // 'c' foi gravado pelo write-through durante o rebuild: existe no Postgres e fica
    const collection = fakeCollection('os_read_model', ['a', 'b', 'c', 'orfao']);

    const result = await rebuildCollection(collection as unknown as Collection<Doc>, {
      pages: paginas<Doc>([{ _id: 'a', v: 1 }], [], [{ _id: 'b', v: 2 }]),
      existentes: existentesEm('a', 'b', 'c'),
    });

    expect(collection.bulkWrite).toHaveBeenCalledTimes(2);
    expect(collection.bulkWrite).toHaveBeenNthCalledWith(
      1,
      [{ replaceOne: { filter: { _id: 'a' }, replacement: { _id: 'a', v: 1 }, upsert: true } }],
      { ordered: false }
    );
    expect(collection.deleteMany).toHaveBeenCalledTimes(1);
    expect(collection.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['orfao'] } });
    expect(result).toEqual({ collection: 'os_read_model', upserted: 2, removed: 1 });
  });

  it('com versionado, só substitui documento igual ou mais antigo', async () => {
    const collection = fakeCollection('os_read_model', ['a']);
    const updatedAt = new Date('2026-01-01');

    await rebuildCollection(collection as unknown as Collection<Doc>, {
      pages: paginas<Doc>([{ _id: 'a', v: 1, updatedAt }]),
      existentes: existentesEm('a'),
      versionado: true,
    });

    const [ops] = collection.bulkWrite.mock.calls[0] as [
      Array<{ replaceOne: { filter: unknown } }>,
    ];
    expect(ops[0].replaceOne.filter).toEqual({ _id: 'a', updatedAt: { $lte: updatedAt } });
  });

  it('ignora E11000 do bulk (documento mais novo já gravado) e propaga outras falhas', async () => {
    const collection = fakeCollection('os_read_model', ['a']);
    const duplicada = new MongoBulkWriteError(
      { message: 'dup', code: 11000, writeErrors: [] } as never,
      {} as never
    );
    Object.defineProperty(duplicada, 'writeErrors', { value: [{ code: 11000 }] });
    collection.bulkWrite.mockRejectedValueOnce(duplicada);

    await expect(
      rebuildCollection(collection as unknown as Collection<Doc>, {
        pages: paginas<Doc>([{ _id: 'a', v: 1 }]),
        existentes: existentesEm('a'),
      })
    ).resolves.toEqual({ collection: 'os_read_model', upserted: 1, removed: 0 });

    collection.bulkWrite.mockRejectedValueOnce(new Error('timeout'));
    await expect(
      rebuildCollection(collection as unknown as Collection<Doc>, {
        pages: paginas<Doc>([{ _id: 'a', v: 1 }]),
        existentes: existentesEm('a'),
      })
    ).rejects.toThrow('timeout');
  });

  it('fonte vazia não apaga a coleção', async () => {
    const collection = fakeCollection('os_read_model', ['a', 'b']);

    const result = await rebuildCollection(collection as unknown as Collection<Doc>, {
      pages: paginas<Doc>(),
      existentes: existentesEm(),
    });

    expect(collection.deleteMany).not.toHaveBeenCalled();
    expect(result.removed).toBe(0);
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
    const collection = fakeCollection('os_read_model', ['os-1']);
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([os])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'os-1' }]);
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
    expect(ops[0]).toEqual(
      expect.objectContaining({
        replaceOne: expect.objectContaining({
          filter: { _id: 'os-1', updatedAt: { $lte: os.updated_at } },
        }),
      })
    );
    expect(findMany).toHaveBeenNthCalledWith(3, {
      where: { id: { in: ['os-1'] } },
      select: { id: true },
    });
    expect(result).toEqual({ collection: 'os_read_model', upserted: 1, removed: 0 });
  });

  it('ClienteReadModelRebuilder reconstrói a coleção de clientes', async () => {
    const collection = fakeCollection('cliente_read_model', ['cli-1', 'cli-apagado']);
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'cli-1' }]);
    const rebuilder = new ClienteReadModelRebuilder(
      { cliente: { findMany } } as unknown as PrismaService,
      { collection: jest.fn(() => collection) } as unknown as Db
    );

    const result = await rebuilder.rebuild();

    expect(result).toEqual({ collection: 'cliente_read_model', upserted: 1, removed: 1 });
    expect(collection.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['cli-apagado'] } });
    const [ops] = collection.bulkWrite.mock.calls[0] as [
      Array<{ replaceOne: { replacement: unknown } }>,
    ];
    expect(ops[0].replaceOne.replacement).toEqual(
      expect.objectContaining({ _id: 'cli-1', documento: '529.982.247-25' })
    );
  });
});
