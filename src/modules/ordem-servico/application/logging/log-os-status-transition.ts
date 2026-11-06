import type { OSStatus } from '../../domain/entities/ordem-servico.entity';

export const OS_STATUS_TRANSITION_LOGGER = Symbol('OS_STATUS_TRANSITION_LOGGER');

export interface OSStatusTransitionRecord extends Record<string, unknown> {
  logType: 'os.status.transition';
  previousStatus: OSStatus;
  newStatus: 'FINISHED' | 'CLOSED_WITHOUT_EXECUTION';
}

export interface IOSStatusTransitionLogger {
  log(record: OSStatusTransitionRecord): void;
}

export function logOsStatusTransition(
  logger: IOSStatusTransitionLogger,
  previousStatus: OSStatus,
  newStatus: 'FINISHED' | 'CLOSED_WITHOUT_EXECUTION'
): void {
  try {
    logger.log({
      logType: 'os.status.transition',
      previousStatus,
      newStatus,
      correlationId: undefined,
      ordemServicoId: undefined,
      eventId: undefined,
    });
  } catch {
    // Best-effort telemetry must not interfere with the committed transition's follow-up work.
  }
}
