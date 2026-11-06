import type { Logger as PinoLoggerInstance } from 'pino';
import type {
  IOSStatusTransitionLogger,
  OSStatusTransitionRecord,
} from '../../application/logging/log-os-status-transition';

export class OsStatusTransitionPinoLogger implements IOSStatusTransitionLogger {
  constructor(private readonly rootLogger: PinoLoggerInstance) {}

  log(record: OSStatusTransitionRecord): void {
    this.rootLogger.info(record);
  }
}
