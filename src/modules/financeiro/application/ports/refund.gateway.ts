export interface IRefundGateway {
  refund(paymentId: string, amount: number): Promise<void>;
}
