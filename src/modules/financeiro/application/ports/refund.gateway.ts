export interface IRefundGateway {
  refund(paymentId: string, amount: number, idempotencyKey: string): Promise<void>;
}
