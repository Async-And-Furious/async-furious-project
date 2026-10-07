import type { IRefundGateway } from '../../application/ports/refund.gateway';

export interface RefundGatewayConfig {
  endpoint?: string;
  token?: string;
}

/** Adapter for the approved refund provider; provider-specific details stay outside the domain. */
export class ConfiguredRefundGateway implements IRefundGateway {
  constructor(private readonly config: RefundGatewayConfig) {}

  async refund(paymentId: string, amount: number, idempotencyKey: string): Promise<void> {
    const { endpoint, token } = this.config;
    if (!endpoint || !token) {
      throw new Error('Refund gateway is not configured');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ paymentId, amount }),
    });
    if (!response.ok) throw new Error(`Refund gateway failed with status ${response.status}`);
  }
}
