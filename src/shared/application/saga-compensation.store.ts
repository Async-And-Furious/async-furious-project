export interface ISagaCompensationStore {
  claimRefund(
    paymentId: string,
    amount: number
  ): Promise<{ idempotencyKey: string; fencingToken: string } | null>;
  claimEvent(eventId: string, ordemServicoId: string): Promise<boolean>;
  recordEvidence(eventId: string, evidence: string): Promise<void>;
  markSagaPublicationFailed(eventId: string, error: string): Promise<void>;
  completeRefund(paymentId: string, fencingToken: string): Promise<void>;
  refundCompleted(paymentId: string): Promise<boolean>;
  completeSaga(ordemServicoId: string, eventId: string, compensacoes: string[]): Promise<boolean>;
  markSagaPublished(eventId: string): Promise<void>;
}
