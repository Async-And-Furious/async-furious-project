import pino, { type Logger as PinoLoggerInstance } from 'pino';
import type {
  IOSStatusTransitionLogger,
  OSStatusTransitionRecord,
} from '../../application/logging/log-os-status-transition';

export class OsStatusTransitionPinoLogger implements IOSStatusTransitionLogger {
  constructor(
    private readonly logger: PinoLoggerInstance = pino({
      base: { service: 'async-furious-project' },
    })
  ) {}

  log(record: OSStatusTransitionRecord): void {
    this.logger.info(record);
  }
}
