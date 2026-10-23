import { MercadoPagoWebhookController } from '../../src/modules/financeiro/presentation/controllers/mercado-pago-webhook.controller';
import type { ProcessarNotificacaoPagamentoUseCase } from '../../src/modules/financeiro/application/use-cases/processar-notificacao-pagamento.use-case';

describe('MercadoPagoWebhookController', () => {
  let mockUseCase: jest.Mocked<Pick<ProcessarNotificacaoPagamentoUseCase, 'execute'>>;
  let controller: MercadoPagoWebhookController;

  beforeEach(() => {
    mockUseCase = { execute: jest.fn().mockResolvedValue('CONFIRMADO') };
    controller = new MercadoPagoWebhookController(
      mockUseCase as unknown as ProcessarNotificacaoPagamentoUseCase
    );
  });

  it('deve processar notificação do tópico payment', async () => {
    await controller.receber('123456', 'payment');

    expect(mockUseCase.execute).toHaveBeenCalledWith('123456');
  });

  it('deve ignorar outros tópicos', async () => {
    await controller.receber('987', 'merchant_order');

    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('deve ignorar notificação sem data.id', async () => {
    await controller.receber(undefined, 'payment');

    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('deve propagar falha para o Mercado Pago reenviar', async () => {
    mockUseCase.execute.mockRejectedValue(new Error('timeout'));

    await expect(controller.receber('123456', 'payment')).rejects.toThrow('timeout');
  });
});
