import { logOsStatusTransition } from '../../src/shared/infrastructure/logging/os-status-transition';

describe('logOsStatusTransition', () => {
  it('logs only the fixed safe fields', () => {
    const logger = { log: jest.fn() };

    logOsStatusTransition(logger, 'IN_PROGRESS', 'FINISHED');

    const fields: unknown = logger.log.mock.calls[0][0];
    expect(fields).toEqual({
      logType: 'os.status.transition',
      previousStatus: 'IN_PROGRESS',
      newStatus: 'FINISHED',
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
});
