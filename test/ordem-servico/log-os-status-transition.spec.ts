import { logOsStatusTransition } from '../../src/modules/ordem-servico/application/logging/log-os-status-transition';
import pino from 'pino';
import {
  pinoHttpOptions,
  runWithLogContext,
} from '../../src/shared/infrastructure/logging/pino-logger.config';
import { Store, storage } from 'nestjs-pino/storage';
import { OsStatusTransitionPinoLogger } from '../../src/modules/ordem-servico/infrastructure/logging/os-status-transition-pino-logger';

describe('logOsStatusTransition', () => {
  it('logs only the fixed safe fields', () => {
    const logger = { log: jest.fn() };

    logOsStatusTransition(logger, 'IN_PROGRESS', 'FINISHED');

    const fields: unknown = logger.log.mock.calls[0][0];
    expect(fields).toEqual({
      logType: 'os.status.transition',
      previousStatus: 'IN_PROGRESS',
      newStatus: 'FINISHED',
      correlationId: undefined,
      ordemServicoId: undefined,
      eventId: undefined,
    });
  });

  it('does not let logger failures affect the caller', () => {
    const logger = {
      log: jest.fn(() => {
        throw new Error('logger unavailable');
      }),
    };

    expect(() =>
      logOsStatusTransition(logger, 'AWAITING_APPROVAL', 'CLOSED_WITHOUT_EXECUTION')
    ).not.toThrow();
  });

  it('serializes without HTTP bindings or Kafka IDs through the real Nest/Pino context chain', () => {
    const lines: string[] = [];
    const root = pino(
      { mixin: pinoHttpOptions.mixin },
      { write: (line: string) => lines.push(line) }
    );
    const requestLogger = root.child({
      req: { id: 'private-request-id', headers: { authorization: 'private-token' } },
      correlationId: 'private-http-correlation',
    });
    const transitionLogger = new OsStatusTransitionPinoLogger(root);

    storage.run(new Store(requestLogger), () =>
      runWithLogContext({ ordemServicoId: 'private-order-id', eventId: 'private-event-id' }, () =>
        logOsStatusTransition(transitionLogger, 'IN_PROGRESS', 'FINISHED')
      )
    );

    expect(lines).toHaveLength(1);
    const raw = lines[0];
    const record = JSON.parse(raw) as Record<string, unknown>;
    expect(record).toMatchObject({
      logType: 'os.status.transition',
      previousStatus: 'IN_PROGRESS',
      newStatus: 'FINISHED',
    });
    for (const sensitive of [
      'private-order-id',
      'private-event-id',
      'private-request-id',
      'private-http-correlation',
      'private-token',
      'req',
    ]) {
      expect(raw).not.toContain(sensitive);
    }
    expect(record).not.toHaveProperty('correlationId');
    expect(record).not.toHaveProperty('ordemServicoId');
    expect(record).not.toHaveProperty('eventId');
    expect(record).not.toHaveProperty('req');
  });
});
