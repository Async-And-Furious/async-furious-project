import type { Logger } from '@nestjs/common';
import type { OSStatus } from '../../../modules/ordem-servico/domain/entities/ordem-servico.entity';

type TransitionLogger = Pick<Logger, 'log'>;

export function logOsStatusTransition(
  logger: TransitionLogger,
  previousStatus: OSStatus,
  newStatus: 'FINISHED' | 'CLOSED_WITHOUT_EXECUTION'
): void {
  try {
    logger.log({
      logType: 'os.status.transition',
      previousStatus,
      newStatus,
    });
  } catch {
    // Best-effort telemetry must not interfere with the committed transition's follow-up work.
  }
}
