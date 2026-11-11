import type { Filter } from 'mongodb';

const DUPLICATE_KEY = 11000;

export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === DUPLICATE_KEY;
}

// Filtro do upsert condicionado à versão: se o documento existente é mais
// novo, o filtro não casa, o upsert tenta inserir o mesmo _id e o driver
// devolve E11000, tratado como no-op por quem chama.
export function versionFilter<T extends { _id: string; updatedAt: Date }>(doc: T): Filter<T> {
  return { _id: doc._id, updatedAt: { $lte: doc.updatedAt } } as Filter<T>;
}
