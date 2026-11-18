import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import {
  API_PREFIX,
  buildSwaggerDocument,
} from '../src/shared/infrastructure/swagger/swagger.config';

// Exporta o OpenAPI do OS Service sem subir o servidor nem conectar no banco
// (NestFactory.create não dispara onModuleInit). Evidência do Swagger no README.
const OUTPUT = resolve(__dirname, '..', 'docs', 'http', 'openapi', 'os-service.openapi.json');

async function main(): Promise<void> {
  // O export não valida token nem conecta no banco: os valores só satisfazem a
  // configuração dos módulos e são gerados a cada execução, sem credencial no código.
  process.env.JWT_SECRET ??= randomUUID();
  process.env.JWT_CUSTOMER_PUBLIC_KEY ??= randomUUID();
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/openapi';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX);
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
