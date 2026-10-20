import { createHmac } from 'node:crypto';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MercadoPagoAssinaturaGuard } from '../../../src/modules/financeiro/infrastructure/webhooks/mercado-pago-assinatura.guard';

const SECRET = 'segredo-de-teste';

const assinar = (dataId: string, requestId: string, ts: string, secret = SECRET) =>
  createHmac('sha256', secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');

const makeContext = (headers: Record<string, string>, query: Record<string, string>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => headers[name.toLowerCase()],
        query,
      }),
    }),
  }) as unknown as ExecutionContext;

const makeGuard = (secret: string | undefined = SECRET) =>
  new MercadoPagoAssinaturaGuard({ get: () => secret } as unknown as ConfigService);

describe('MercadoPagoAssinaturaGuard', () => {
  const ts = '1704908010';
  const requestId = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';

  it('deve aceitar notificação assinada com o data.id da query string', () => {
    const context = makeContext(
      {
        'x-signature': `ts=${ts},v1=${assinar('123456', requestId, ts)}`,
        'x-request-id': requestId,
      },
      { 'data.id': '123456', type: 'payment' }
    );

    expect(makeGuard().canActivate(context)).toBe(true);
  });

  it('deve recusar assinatura calculada com outro segredo', () => {
    const context = makeContext(
      {
        'x-signature': `ts=${ts},v1=${assinar('123456', requestId, ts, 'outro')}`,
        'x-request-id': requestId,
      },
      { 'data.id': '123456' }
    );

    expect(() => makeGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it('deve recusar quando o data.id da query foi alterado', () => {
    const context = makeContext(
      {
        'x-signature': `ts=${ts},v1=${assinar('123456', requestId, ts)}`,
        'x-request-id': requestId,
      },
      { 'data.id': '999999' }
    );

    expect(() => makeGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it('deve recusar notificação sem x-signature', () => {
    const context = makeContext({ 'x-request-id': requestId }, { 'data.id': '123456' });

    expect(() => makeGuard().canActivate(context)).toThrow(UnauthorizedException);
  });

  it('deve recusar tudo quando MP_WEBHOOK_SECRET não está configurado', () => {
    const context = makeContext(
      {
        'x-signature': `ts=${ts},v1=${assinar('123456', requestId, ts)}`,
        'x-request-id': requestId,
      },
      { 'data.id': '123456' }
    );

    expect(() => makeGuard('').canActivate(context)).toThrow(UnauthorizedException);
  });
});
