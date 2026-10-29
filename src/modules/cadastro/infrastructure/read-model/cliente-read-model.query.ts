import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import {
  CLIENTE_READ_MODEL_COLLECTION,
  READ_MODEL_DB,
} from '../../../../shared/infrastructure/read-model/read-model.config';
import { ClienteReadModelDocument, toClienteLeitura } from './cliente-read-model.document';
import type {
  ClienteLeitura,
  IClienteReadModelQuery,
} from '../../domain/interfaces/cliente-read-model.interface';

@Injectable()
export class ClienteReadModelQuery implements IClienteReadModelQuery {
  constructor(@Inject(READ_MODEL_DB) private readonly db: Db) {}

  async findById(id: string): Promise<ClienteLeitura | null> {
    const doc = await this.db
      .collection<ClienteReadModelDocument>(CLIENTE_READ_MODEL_COLLECTION)
      .findOne({ _id: id });
    return doc ? toClienteLeitura(doc) : null;
  }
}
