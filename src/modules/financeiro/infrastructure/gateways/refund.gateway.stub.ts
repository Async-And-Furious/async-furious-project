import { Injectable } from '@nestjs/common';
import type { IRefundGateway } from '../../application/ports/refund.gateway';

@Injectable()
export class RefundGatewayStub implements IRefundGateway {
  async refund(_paymentId: string, _amount: number, _idempotencyKey: string): Promise<void> {
    // The external gateway is supplied by the deployment; this adapter keeps local runtime wiring explicit.
  }
}
