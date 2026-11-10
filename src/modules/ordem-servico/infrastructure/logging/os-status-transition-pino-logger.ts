import pino, { type Logger as PinoLoggerInstance } from 'pino';
import type {
  IOSStatusTransitionLogger,
  OSStatusTransitionRecord,
} from '../../application/logging/log-os-status-transition';
import { SERVICE_NAME } from '../../../../shared/infrastructure/logging/pino-logger.config';

export class OsStatusTransitionPinoLogger implements IOSStatusTransitionLogger {
  constructor(
    private readonly logger: PinoLoggerInstance = pino({
      base: { service: SERVICE_NAME },
    })
  ) {}

  log(record: OSStatusTransitionRecord): void {
    this.logger.info(record);
  }
}
