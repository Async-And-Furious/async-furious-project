import type { OSStatus } from '../entities/ordem-servico.entity';

export const STATUS_PRIORIDADE: Record<OSStatus, number> = {
  IN_PROGRESS: 1,
  AWAITING_APPROVAL: 2,
  UNDER_DIAGNOSIS: 3,
  RECEIVED: 4,
  AWAITING_PARTS: 5,
  CLOSED_WITHOUT_EXECUTION: 6,
  FINISHED: 7,
  DELIVERED: 8,
};

// Saem da fila (filtro status $nin na consulta do read model); continuam
// acessíveis por GET /ordens-servico/:id.
export const STATUS_EXCLUIDOS_DA_LISTAGEM: OSStatus[] = [
  'FINISHED',
  'DELIVERED',
  'CLOSED_WITHOUT_EXECUTION',
];

export function getPrioridadeStatus(status: OSStatus): number {
  return STATUS_PRIORIDADE[status] ?? 9;
}
