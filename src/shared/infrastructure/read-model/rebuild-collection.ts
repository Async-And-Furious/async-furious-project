import type { AnyBulkWriteOperation, Collection, Filter, WithoutId } from 'mongodb';

export interface RebuildResult {
  collection: string;
  upserted: number;
  removed: number;
}

// Reconstrói uma coleção a partir de páginas lidas do Postgres: replaceOne com
// upsert em lote e, no fim, remove documentos cujo id não existe mais na fonte.
export async function rebuildCollection<T extends { _id: string }>(
  collection: Collection<T>,
  pages: AsyncIterable<T[]>
): Promise<RebuildResult> {
  const ids: string[] = [];
  for await (const docs of pages) {
    if (docs.length === 0) continue;
    const ops: AnyBulkWriteOperation<T>[] = docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id } as Filter<T>,
        replacement: doc as WithoutId<T>,
        upsert: true,
      },
    }));
    await collection.bulkWrite(ops, { ordered: false });
    ids.push(...docs.map((doc) => doc._id));
  }
  const { deletedCount } = await collection.deleteMany({ _id: { $nin: ids } } as Filter<T>);
  return { collection: collection.collectionName, upserted: ids.length, removed: deletedCount };
}
