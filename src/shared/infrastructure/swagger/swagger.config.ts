import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const SWAGGER_PATH = 'api/docs';

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Async Furious - OS Service')
    .setDescription(
      'API do OS Service: ordens de serviço, clientes, veículos, serviços e peças/insumos. ' +
        'Todas as rotas exigem JWT, exceto GET /ordens-servico/{id}/status. ' +
        'Nenhuma rota é consumida por outro serviço: Billing e Execução integram por eventos.'
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-webhook-secret' }, 'webhook-secret')
    .build();
  return markPublicOperations(SwaggerModule.createDocument(app, config));
}

// O @ApiBearerAuth() de classe se soma ao do método; uma rota pública marcada
// com @ApiSecurity({}) sai com security: [] (sem autenticação) no documento.
function markPublicOperations(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem) as OperationObject[]) {
      const isPublic = operation?.security?.some((req) => Object.keys(req).length === 0);
      if (isPublic) operation.security = [];
    }
  }
  return document;
}
