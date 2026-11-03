import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/shared/infrastructure/swagger/swagger.config';

// Exporta o OpenAPI do OS Service sem subir o servidor nem conectar no banco
// (NestFactory.create não dispara onModuleInit). Evidência do Swagger no README.
const OUTPUT = resolve(__dirname, '..', 'docs', 'http', 'openapi', 'os-service.openapi.json');

async function main(): Promise<void> {
  process.env.JWT_SECRET ??= 'openapi-export';
  process.env.JWT_CUSTOMER_PUBLIC_KEY ??= 'openapi-export';
  process.env.DATABASE_URL ??= 'postgresql://openapi:export@localhost:5432/openapi';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  const document = buildSwaggerDocument(app);

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  process.stdout.write(`OpenAPI exportado em ${OUTPUT}\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`Falha ao exportar o OpenAPI: ${String(err)}\n`);
  process.exit(1);
});
