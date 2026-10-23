const mockPreferenceCreate = jest.fn();
const mockPaymentGet = jest.fn();

jest.mock('mercadopago', () => {
  class MPNotFoundError extends Error {}
  return {
    MercadoPagoConfig: jest.fn().mockImplementation((config: unknown) => config),
    Preference: jest.fn().mockImplementation(() => ({ create: mockPreferenceCreate })),
    Payment: jest.fn().mockImplementation(() => ({ get: mockPaymentGet })),
    MPNotFoundError,
  };
});

import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, MPNotFoundError } from 'mercadopago';
import { MercadoPagoGateway } from '../../../src/modules/financeiro/infrastructure/gateways/mercado-pago.gateway';

const makeConfig = (env: Record<string, string | undefined>) =>
  ({ get: jest.fn((key: string) => env[key]) }) as unknown as ConfigService;

describe('MercadoPagoGateway', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve criar a preference do Checkout Pro e devolver o init_point', async () => {
    mockPreferenceCreate.mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
      sandbox_init_point: 'https://sandbox.mercadopago.com.br/ignorar',
    });
    const gateway = new MercadoPagoGateway(
      makeConfig({
        MP_ACCESS_TOKEN: 'APP_USR-fake',
        MP_NOTIFICATION_URL: 'https://exemplo.test/api/v1/webhooks/mercado-pago',
      })
    );

    const cobranca = await gateway.criarCobranca('os-1', 150.5);

    expect(cobranca).toEqual({
      preferenceId: 'pref-1',
      linkPagamento: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
    });
    expect(MercadoPagoConfig).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'APP_USR-fake' })
    );
    expect(mockPreferenceCreate).toHaveBeenCalledWith({
      body: {
        items: [
          {
            id: 'os-1',
            title: 'Ordem de serviço os-1',
            quantity: 1,
            unit_price: 150.5,
            currency_id: 'BRL',
          },
        ],
        external_reference: 'os-1',
        notification_url: 'https://exemplo.test/api/v1/webhooks/mercado-pago',
      },
    });
  });

  it('deve omitir notification_url quando MP_NOTIFICATION_URL não está definida', async () => {
    mockPreferenceCreate.mockResolvedValue({ id: 'pref-1', init_point: 'https://mp.test/x' });
    const gateway = new MercadoPagoGateway(makeConfig({ MP_ACCESS_TOKEN: 'APP_USR-fake' }));

    await gateway.criarCobranca('os-1', 10);

    expect(mockPreferenceCreate.mock.calls[0][0].body.notification_url).toBeUndefined();
  });

  it('deve falhar sem chamar o Mercado Pago quando MP_ACCESS_TOKEN não está configurado', async () => {
    const gateway = new MercadoPagoGateway(makeConfig({}));

    await expect(gateway.criarCobranca('os-1', 10)).rejects.toThrow(
      'MP_ACCESS_TOKEN não configurado.'
    );
    expect(mockPreferenceCreate).not.toHaveBeenCalled();
  });

  it('deve traduzir erro do SDK em 502', async () => {
    mockPreferenceCreate.mockRejectedValue({ message: 'invalid access token', status: 401 });
    const gateway = new MercadoPagoGateway(makeConfig({ MP_ACCESS_TOKEN: 'APP_USR-fake' }));

    await expect(gateway.criarCobranca('os-1', 10)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('deve devolver 502 quando a resposta não traz init_point', async () => {
    mockPreferenceCreate.mockResolvedValue({ id: 'pref-1' });
    const gateway = new MercadoPagoGateway(makeConfig({ MP_ACCESS_TOKEN: 'APP_USR-fake' }));

    await expect(gateway.criarCobranca('os-1', 10)).rejects.toBeInstanceOf(BadGatewayException);
  });

  describe('consultarPagamento', () => {
    it('deve mapear o pagamento do Mercado Pago', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 123,
        status: 'approved',
        external_reference: 'os-1',
        transaction_amount: 369.9,
      });
      const gateway = new MercadoPagoGateway(makeConfig({ MP_ACCESS_TOKEN: 'APP_USR-fake' }));

      await expect(gateway.consultarPagamento('123')).resolves.toEqual({
        id: '123',
        status: 'approved',
        referenciaExterna: 'os-1',
        valor: 369.9,
      });
      expect(mockPaymentGet).toHaveBeenCalledWith({ id: '123' });
    });

    it('deve devolver null quando o pagamento não existe', async () => {
      mockPaymentGet.mockRejectedValue(Object.create(MPNotFoundError.prototype) as Error);
      const gateway = new MercadoPagoGateway(makeConfig({ MP_ACCESS_TOKEN: 'APP_USR-fake' }));

      await expect(gateway.consultarPagamento('123')).resolves.toBeNull();
    });

    it('deve traduzir outros erros em 502', async () => {
      mockPaymentGet.mockRejectedValue(new Error('timeout'));
      const gateway = new MercadoPagoGateway(makeConfig({ MP_ACCESS_TOKEN: 'APP_USR-fake' }));

      await expect(gateway.consultarPagamento('123')).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
