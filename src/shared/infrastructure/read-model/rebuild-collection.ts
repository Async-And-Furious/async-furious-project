import { MongoBulkWriteError } from 'mongodb';
import { isDuplicateKeyError, versionFilter } from './version-guard';
import type { AnyBulkWriteOperation, Collection, Filter, WithoutId } from 'mongodb';

export interface RebuildResult {
  collection: string;
  upserted: number;
  removed: number;
}

export interface RebuildSource<T extends { _id: string }> {
  // Páginas de documentos montadas a partir do Postgres.
  pages: AsyncIterable<T[]>;
  // Dos ids informados, devolve os que ainda existem no Postgres agora.
  existentes(ids: string[]): Promise<Set<string>>;
  // Documentos com updatedAt só são substituídos por snapshot igual ou mais
  // novo, para o rebuild não sobrescrever uma projeção feita durante ele.
  versionado?: boolean;
}

const CLEANUP_BATCH_SIZE = 500;

// Reconstrói uma coleção a partir do Postgres com replaceOne + upsert em lote.
// No fim, remove só os documentos cujo id não existe mais no Postgres no
// momento da remoção: o que o write-through gravou durante o rebuild fica.
export async function rebuildCollection<T extends { _id: string }>(
  collection: Collection<T>,
  source: RebuildSource<T>
): Promise<RebuildResult> {
  let upserted = 0;
  for await (const docs of source.pages) {
    if (docs.length === 0) continue;
    const ops: AnyBulkWriteOperation<T>[] = docs.map((doc) => ({
      replaceOne: {
        filter: source.versionado
          ? (versionFilter(doc as unknown as T & { updatedAt: Date }) as Filter<T>)
          : ({ _id: doc._id } as Filter<T>),
        replacement: doc as WithoutId<T>,
        upsert: true,
      },
    }));
    await bulkWriteIgnorandoVersaoMaisNova(collection, ops);
    upserted += docs.length;
  }

  // Fonte vazia (ex.: DATABASE_URL errada) não pode apagar a coleção inteira.
  if (upserted === 0) {
    return { collection: collection.collectionName, upserted, removed: 0 };
  }

  let removed = 0;
  let lote: string[] = [];
  const limparLote = async (): Promise<void> => {
    const existentes = await source.existentes(lote);
    const orfaos = lote.filter((id) => !existentes.has(id));
    if (orfaos.length > 0) {
      const { deletedCount } = await collection.deleteMany({ _id: { $in: orfaos } } as Filter<T>);
      removed += deletedCount;
    }
    lote = [];
  };
  for await (const { _id } of collection.find({}, { projection: { _id: 1 } })) {
    lote.push(_id as string);
    if (lote.length === CLEANUP_BATCH_SIZE) await limparLote();
  }
  if (lote.length > 0) await limparLote();

  return { collection: collection.collectionName, upserted, removed };
}

async function bulkWriteIgnorandoVersaoMaisNova<T extends { _id: string }>(
  collection: Collection<T>,
  ops: AnyBulkWriteOperation<T>[]
): Promise<void> {
  try {
    await collection.bulkWrite(ops, { ordered: false });
  } catch (error) {
    if (!(error instanceof MongoBulkWriteError)) throw error;
    const { writeErrors } = error;
    const lista = Array.isArray(writeErrors) ? writeErrors : [writeErrors];
    if (!lista.every(isDuplicateKeyError)) throw error;
  }
}
