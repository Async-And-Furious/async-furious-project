import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RebuildReadModelModule } from './rebuild-read-model.module';
import { OsReadModelRebuilder } from '../modules/ordem-servico/infrastructure/read-model/os-read-model.rebuilder';
import { ClienteReadModelRebuilder } from '../modules/cadastro/infrastructure/read-model/cliente-read-model.rebuilder';

// Job sob demanda (e no pipeline, depois da migration): reconstrói
// os_read_model e cliente_read_model a partir do PostgreSQL.
// Uso: node dist/jobs/rebuild-read-model.job.js
async function main(): Promise<void> {
  const logger = new Logger('RebuildReadModel');
  const app = await NestFactory.createApplicationContext(RebuildReadModelModule);
  try {
    for (const rebuilder of [app.get(ClienteReadModelRebuilder), app.get(OsReadModelRebuilder)]) {
      const result = await rebuilder.rebuild();
      logger.log(
        `${result.collection}: ${result.upserted} documento(s) gravado(s), ${result.removed} removido(s)`
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Falha no rebuild do read model: ${String(err)}\n`);
  process.exit(1);
});
