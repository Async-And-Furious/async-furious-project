import { Global, Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { ReadModelBootstrapService } from './read-model-bootstrap.service';
import { ReadModelFailureReporter } from './read-model-failure.reporter';
import { READ_MODEL_CLIENT, READ_MODEL_DB, resolveReadModelConnection } from './read-model.config';
import type { Db } from 'mongodb';

// Lado de leitura do OS Service (ADR-0019): DocumentDB pelo driver mongodb.
@Global()
@Module({
  providers: [
    {
      provide: READ_MODEL_CLIENT,
      useFactory: (): MongoClient => {
        const { uri, options } = resolveReadModelConnection(process.env);
        return new MongoClient(uri, options);
      },
    },
    {
      provide: READ_MODEL_DB,
      useFactory: (client: MongoClient): Db =>
        client.db(resolveReadModelConnection(process.env).database),
      inject: [READ_MODEL_CLIENT],
    },
    { provide: ReadModelFailureReporter, useFactory: () => new ReadModelFailureReporter() },
    ReadModelBootstrapService,
  ],
  exports: [READ_MODEL_CLIENT, READ_MODEL_DB, ReadModelFailureReporter],
})
export class ReadModelModule {}
