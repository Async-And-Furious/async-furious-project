import { logOsStatusTransition } from '../../src/modules/ordem-servico/application/logging/log-os-status-transition';
import pino from 'pino';
import {
  pinoHttpOptions,
  runWithLogContext,
} from '../../src/shared/infrastructure/logging/pino-logger.config';

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

  it('serializes without Kafka context identifiers through the real Pino mixin', () => {
    const records: Record<string, unknown>[] = [];
    const logger = pino(
      { mixin: pinoHttpOptions.mixin },
      { write: (line: string) => records.push(JSON.parse(line) as Record<string, unknown>) }
    );

    runWithLogContext({ ordemServicoId: 'private-order-id', eventId: 'private-event-id' }, () =>
      logOsStatusTransition({ log: (fields) => logger.info(fields) }, 'IN_PROGRESS', 'FINISHED')
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      logType: 'os.status.transition',
      previousStatus: 'IN_PROGRESS',
      newStatus: 'FINISHED',
    });
    expect(JSON.stringify(records[0])).not.toContain('private-order-id');
    expect(JSON.stringify(records[0])).not.toContain('private-event-id');
    expect(records[0]).not.toHaveProperty('correlationId');
    expect(records[0]).not.toHaveProperty('ordemServicoId');
    expect(records[0]).not.toHaveProperty('eventId');
  });
});
