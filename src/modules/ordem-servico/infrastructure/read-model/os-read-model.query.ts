import { Inject, Injectable } from '@nestjs/common';
import { Db, Filter } from 'mongodb';
import {
  OS_READ_MODEL_COLLECTION,
  READ_MODEL_DB,
} from '../../../../shared/infrastructure/read-model/read-model.config';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { STATUS_EXCLUIDOS_DA_LISTAGEM } from '../../domain/policies/status-priority.policy';
import {
  OsReadModelDocument,
  toOrdemServicoLeitura,
  toStatusLeitura,
} from './os-read-model.document';
import type {
  FilaOrdensServicoPagina,
  IOsReadModelQuery,
  OrdemServicoLeitura,
  StatusOrdemServicoLeitura,
} from '../../domain/interfaces/os-read-model.interface';

interface FilaCursor {
  prioridade: number;
  createdAt: Date;
  id: string;
}

export function encodeFilaCursor(
  doc: Pick<OsReadModelDocument, 'prioridade' | 'createdAt' | '_id'>
): string {
  const payload = { p: doc.prioridade, c: doc.createdAt.toISOString(), i: doc._id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeFilaCursor(cursor: string): FilaCursor {
  try {
    const { p, c, i } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      p: unknown;
      c: unknown;
      i: unknown;
    };
    const createdAt = new Date(String(c));
    if (typeof p !== 'number' || typeof i !== 'string' || Number.isNaN(createdAt.getTime())) {
      throw new Error('cursor malformado');
    }
    return { prioridade: p, createdAt, id: i };
  } catch {
    throw new DomainException('Cursor de paginação inválido');
  }
}

// Fila por prioridade servida pelo índice (prioridade, createdAt, _id), com
// paginação keyset: a próxima página começa depois do último documento.
@Injectable()
export class OsReadModelQuery implements IOsReadModelQuery {
  constructor(@Inject(READ_MODEL_DB) private readonly db: Db) {}

  private get collection() {
    return this.db.collection<OsReadModelDocument>(OS_READ_MODEL_COLLECTION);
  }

  async listarFila(limit: number, cursor?: string): Promise<FilaOrdensServicoPagina> {
    const filter: Filter<OsReadModelDocument> = { status: { $nin: STATUS_EXCLUIDOS_DA_LISTAGEM } };
    if (cursor) {
      const after = decodeFilaCursor(cursor);
      filter.$or = [
        { prioridade: { $gt: after.prioridade } },
        { prioridade: after.prioridade, createdAt: { $gt: after.createdAt } },
        { prioridade: after.prioridade, createdAt: after.createdAt, _id: { $gt: after.id } },
      ];
    }

    const docs = await this.collection
      .find(filter)
      .sort({ prioridade: 1, createdAt: 1, _id: 1 })
      .limit(limit + 1)
      .toArray();

    const page = docs.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page.map(toOrdemServicoLeitura),
      pagination: {
        limit,
        nextCursor: docs.length > limit && last ? encodeFilaCursor(last) : null,
      },
    };
  }

  async detalhar(id: string): Promise<OrdemServicoLeitura | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toOrdemServicoLeitura(doc) : null;
  }

  async consultarStatus(id: string): Promise<StatusOrdemServicoLeitura | null> {
    const doc = await this.collection.findOne(
      { _id: id },
      { projection: { status: 1, marcos: 1 } }
    );
    return doc ? toStatusLeitura(doc) : null;
  }
}
