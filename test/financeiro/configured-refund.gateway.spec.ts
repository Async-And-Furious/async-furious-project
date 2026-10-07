import { ConfiguredRefundGateway } from '../../src/modules/financeiro/infrastructure/gateways/configured-refund.gateway';

describe('ConfiguredRefundGateway', () => {
  it('fails closed when provider credentials are absent', async () => {
    const gateway = new ConfiguredRefundGateway({});

    await expect(gateway.refund('payment-1', 10, 'refund:payment-1')).rejects.toThrow(
      'Refund gateway is not configured'
    );
  });
});
