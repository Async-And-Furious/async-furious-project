import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import {
  CLIENTE_READ_MODEL_COLLECTION,
  FILA_PRIORIDADE_INDEX,
  OS_READ_MODEL_COLLECTION,
  READ_MODEL_CLIENT,
  READ_MODEL_DB,
} from './read-model.config';
import { ReadModelFailureReporter } from './read-model-failure.reporter';

const SCHEMA_RETRY_MS = 30_000;

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

// DocumentDB fora do ar na subida não derruba a API (as escritas só dependem
// do Postgres): registra a falha e tenta de novo em segundo plano. O driver
// reconecta sozinho na primeira operação.
@Injectable()
export class ReadModelBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadModelBootstrapService.name);
  private retryTimer?: NodeJS.Timeout;

  constructor(
    @Inject(READ_MODEL_CLIENT) private readonly client: MongoClient,
    @Inject(READ_MODEL_DB) private readonly db: Db,
    private readonly failureReporter: ReadModelFailureReporter,
    private readonly retryMs: number = SCHEMA_RETRY_MS
  ) {}

  async onModuleInit(): Promise<void> {
    await this.prepararSchema();
  }

  async onModuleDestroy(): Promise<void> {
    clearTimeout(this.retryTimer);
    await this.client.close();
  }

  private async prepararSchema(): Promise<void> {
    try {
      await this.client.connect();
      await ensureReadModelSchema(this.db);
      this.logger.log(`Read model pronto no banco ${this.db.databaseName}`);
    } catch (error) {
      this.failureReporter.report('bootstrap', this.db.databaseName, error);
      this.retryTimer = setTimeout(() => void this.prepararSchema(), this.retryMs);
      this.retryTimer.unref();
    }
  }
}
