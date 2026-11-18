import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

// Só os verbos HTTP são operações; parameters, summary e servers ficam de fora.
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Async Furious - OS Service')
    .setDescription(
      'API do OS Service: ordens de serviço, clientes, veículos, serviços e peças/insumos. ' +
        'As rotas exigem JWT, exceto GET /ordens-servico/{id}/status, auth/login e health. ' +
        'Orçamento e pagamento são do Billing Service (#330). ' +
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
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      const isPublic = operation?.security?.some((req) => Object.keys(req).length === 0);
      if (operation && isPublic) operation.security = [];
    }
  }
  return document;
}
