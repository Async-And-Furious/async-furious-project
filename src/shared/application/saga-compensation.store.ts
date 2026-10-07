export interface ISagaCompensationStore {
  claimEvent(eventId: string, ordemServicoId: string): Promise<boolean>;
  recordEvidence(eventId: string, evidence: string): Promise<void>;
  prepareRefund(paymentId: string, amount: number): Promise<boolean>;
  completeRefund(paymentId: string): Promise<void>;
  refundCompleted(paymentId: string): Promise<boolean>;
  completeSaga(ordemServicoId: string, eventId: string, compensacoes: string[]): Promise<boolean>;
}
