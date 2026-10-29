import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import {
  CLIENTE_READ_MODEL_COLLECTION,
  FILA_PRIORIDADE_INDEX,
  OS_READ_MODEL_COLLECTION,
  READ_MODEL_CLIENT,
  READ_MODEL_DB,
} from './read-model.config';

// Cria coleções e índices de forma idempotente na subida (o Terraform só
// provisiona o cluster). O índice composto serve a fila por prioridade.
export async function ensureReadModelSchema(db: Db): Promise<void> {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name)
  );
  for (const name of [OS_READ_MODEL_COLLECTION, CLIENTE_READ_MODEL_COLLECTION]) {
    if (!existing.has(name)) await db.createCollection(name);
  }
  await db
    .collection(OS_READ_MODEL_COLLECTION)
    .createIndex({ prioridade: 1, createdAt: 1, _id: 1 }, { name: FILA_PRIORIDADE_INDEX });
}

@Injectable()
export class ReadModelBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadModelBootstrapService.name);

  constructor(
    @Inject(READ_MODEL_CLIENT) private readonly client: MongoClient,
    @Inject(READ_MODEL_DB) private readonly db: Db
  ) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await ensureReadModelSchema(this.db);
    this.logger.log(`Read model pronto no banco ${this.db.databaseName}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
