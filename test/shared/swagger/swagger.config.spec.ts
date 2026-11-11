import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { buildSwaggerDocument } from '../../../src/shared/infrastructure/swagger/swagger.config';

@ApiBearerAuth()
@Controller('recursos')
class RecursoController {
  @Get()
  listar(): string[] {
    return [];
  }

  @Get('publico')
  @ApiSecurity({})
  publico(): string {
    return 'ok';
  }
}

@ApiSecurity({ bearer: [], 'webhook-secret': [] })
@Controller('webhook')
class WebhookController {
  @Post()
  receber(): void {
    return;
  }
}

describe('buildSwaggerDocument', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RecursoController, WebhookController],
    }).compile();
    app = moduleRef.createNestApplication();
  });

  afterAll(async () => {
    await app.close();
  });

  it('descreve o OS Service com JWT e o header do webhook', () => {
    const document = buildSwaggerDocument(app);

    expect(document.info.title).toBe('Async Furious - OS Service');
    expect(document.components?.securitySchemes).toEqual({
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'webhook-secret': { type: 'apiKey', in: 'header', name: 'x-webhook-secret' },
    });
  });

  it('mantém o Bearer nas rotas protegidas e zera a segurança das rotas públicas', () => {
    const document = buildSwaggerDocument(app);

    expect(document.paths['/recursos'].get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths['/recursos/publico'].get?.security).toEqual([]);
  });

  it('combina JWT e x-webhook-secret em um único requisito no webhook', () => {
    const document = buildSwaggerDocument(app);

    expect(document.paths['/webhook'].post?.security).toEqual([
      { bearer: [], 'webhook-secret': [] },
    ]);
  });
});
