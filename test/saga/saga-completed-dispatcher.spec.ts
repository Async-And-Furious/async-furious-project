import { SagaCompletedDispatcher } from '../../src/shared/infrastructure/saga-completed-dispatcher';
import { SagaCompleted } from '../../src/shared/domain/events/saga-compensation.events';

describe('SagaCompletedDispatcher', () => {
  const item = { eventId: 'event-1', ordemServicoId: 'os-1', compensacoes: ['os-fechada'], attempts: 1, fencingToken: 'fence-1' };

  it('polls durable outbox records and publishes with the persisted event id', async () => {
    const store = {
      claimSagaForPublication: jest.fn().mockResolvedValueOnce(item).mockResolvedValueOnce(null),
      markSagaPublished: jest.fn().mockResolvedValue(undefined),
      markSagaPublicationFailed: jest.fn(),
    };
    const emissor = { emitir: jest.fn().mockResolvedValue(undefined) };
    const dispatcher = new SagaCompletedDispatcher(store as never, emissor);

    await dispatcher.poll();

    expect(emissor.emitir).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1', ordemServicoId: 'os-1' })
    );
    expect(emissor.emitir.mock.calls[0][0]).toBeInstanceOf(SagaCompleted);
    expect(store.markSagaPublished).toHaveBeenCalledWith('event-1', 'fence-1');
  });

  it('marks a failed delivery for durable retry instead of losing it', async () => {
    const store = {
      claimSagaForPublication: jest.fn().mockResolvedValueOnce(item).mockResolvedValueOnce(null),
      markSagaPublished: jest.fn(),
      markSagaPublicationFailed: jest.fn().mockResolvedValue(undefined),
    };
    const dispatcher = new SagaCompletedDispatcher(store as never, {
      emitir: jest.fn().mockRejectedValue(new Error('broker down')),
    });

    await dispatcher.poll();

    expect(store.markSagaPublicationFailed).toHaveBeenCalledWith('event-1', 'broker down', 'fence-1');
    expect(store.markSagaPublished).not.toHaveBeenCalled();
  });

  it('continues polling after a publisher crash and preserves idempotency', async () => {
    const store = {
      claimSagaForPublication: jest.fn().mockResolvedValueOnce(item).mockResolvedValueOnce(item).mockResolvedValueOnce(null),
      markSagaPublished: jest.fn().mockRejectedValueOnce(new Error('crash')).mockResolvedValue(undefined),
      markSagaPublicationFailed: jest.fn().mockResolvedValue(undefined),
    };
    const emissor = { emitir: jest.fn().mockResolvedValue(undefined) };
    const dispatcher = new SagaCompletedDispatcher(store as never, emissor);

    await dispatcher.poll();
    await dispatcher.poll();

    expect(emissor.emitir).toHaveBeenCalledTimes(2);
    expect(emissor.emitir.mock.calls[1][0].eventId).toBe('event-1');
    expect(store.markSagaPublished).toHaveBeenLastCalledWith('event-1', 'fence-1');
  });
});
