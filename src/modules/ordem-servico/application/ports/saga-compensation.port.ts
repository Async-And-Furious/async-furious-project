export interface ISagaCompensationPort {
  closeWithoutExecution(ordemServicoId: string, motivo: string): Promise<void>;
}
