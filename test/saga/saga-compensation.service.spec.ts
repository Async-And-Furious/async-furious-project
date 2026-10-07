import { SagaCompensationService } from '../../src/shared/application/saga-compensation.service';
import { EtapaDaSagaFalhou, SagaCompleted } from '../../src/shared/domain/events/saga-compensation.events';
import { Pagamento } from '../../src/modules/financeiro/domain/entities/pagamento.entity';
import type { IReservaEstoqueRepository } from '../../src/modules/pecas-insumos/domain/interfaces/reserva-estoque.repository.interface';

describe('SagaCompensationService', () => {
  const makePayment = (status: 'PAGO' | 'AGUARDANDO_PAGAMENTO'): Pagamento =>
    Pagamento.reconstituir({ id: 'pag-1', ordemServicoId: 'os-1', valor: 100, status });

  it('libera reserva, estorna e publica conclusão idempotentemente', async () => {
    const payment = makePayment('PAGO');
    const os = { closeWithoutExecution: jest.fn() };
    const reservas = {
      save: jest.fn(),
      existsByOrdemId: jest.fn(),
      findByOrdemId: jest.fn(),
      releaseByOrdemId: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<IReservaEstoqueRepository>;
    const pagamentos = {
      findById: jest.fn(),
      findByOrdemServicoId: jest.fn().mockResolvedValue(payment),
      save: jest.fn(),
    };
    const refund = { refund: jest.fn().mockResolvedValue(undefined) };
    const emissor = { emitir: jest.fn() };
    const service = new SagaCompensationService(
      os,
      reservas,
      pagamentos,
      refund,
      emissor
    );
    const event = new EtapaDaSagaFalhou('os-1', 'inicio-execucao', 'timeout');

    await service.compensate(event);
    await service.compensate(event);

    expect(refund.refund).toHaveBeenCalledTimes(1);
    expect(refund.refund).toHaveBeenCalledWith('pag-1', 100, 'refund:pag-1');
    expect(reservas.releaseByOrdemId).toHaveBeenCalledTimes(1);
    expect(payment.getStatus()).toBe(Pagamento.STATUS_ESTORNADO);
    expect(emissor.emitir).toHaveBeenCalledWith(expect.any(SagaCompleted));
  });

  it('não marca o pagamento como estornado quando o refund falha', async () => {
    const payment = makePayment('PAGO');
    const os = { closeWithoutExecution: jest.fn() };
    const reservas = {
      save: jest.fn(),
      existsByOrdemId: jest.fn(),
      findByOrdemId: jest.fn(),
      releaseByOrdemId: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<IReservaEstoqueRepository>;
    const pagamentos = {
      findById: jest.fn(),
      findByOrdemServicoId: jest.fn().mockResolvedValue(payment),
      save: jest.fn(),
    };
    const refund = { refund: jest.fn().mockRejectedValueOnce(new Error('gateway down')).mockResolvedValue(undefined) };
    const emissor = { emitir: jest.fn() };
    const service = new SagaCompensationService(os, reservas, pagamentos, refund, emissor);
    const event = new EtapaDaSagaFalhou('os-1', 'inicio-execucao', 'timeout');

    await expect(service.compensate(event)).rejects.toThrow('gateway down');
    expect(payment.getStatus()).toBe(Pagamento.STATUS_CONFIRMADO);
    await service.compensate(event);
    expect(payment.getStatus()).toBe(Pagamento.STATUS_ESTORNADO);
  });

  it('passes the durable idempotency key and fencing token to the gateway', async () => {
    const payment = makePayment('PAGO');
    const store = {
      claimEvent: jest.fn().mockResolvedValue(true),
      claimRefund: jest.fn().mockResolvedValue({ idempotencyKey: 'refund:pag-1', fencingToken: 'fence-1' }),
      refundCompleted: jest.fn().mockResolvedValue(false),
      completeRefund: jest.fn().mockResolvedValue(undefined),
      completeSaga: jest.fn().mockResolvedValue(true),
      markSagaPublished: jest.fn().mockResolvedValue(undefined),
      recordEvidence: jest.fn(),
    };
    const refund = { refund: jest.fn().mockResolvedValue(undefined) };
    const service = new SagaCompensationService(
      { closeWithoutExecution: jest.fn() },
      { releaseByOrdemId: jest.fn().mockResolvedValue(0) } as never,
      { findByOrdemServicoId: jest.fn().mockResolvedValue(payment), save: jest.fn() } as never,
      refund,
      { emitir: jest.fn() } as never,
      store
    );

    await service.compensate(new EtapaDaSagaFalhou('os-1', 'inicio-execucao', 'timeout', 'failed-1'));

    expect(refund.refund).toHaveBeenCalledWith('pag-1', 100, 'refund:pag-1');
    expect(store.completeRefund).toHaveBeenCalledWith('pag-1', 'fence-1');
  });

  it('does not call the gateway from a concurrent retry without the lease', async () => {
    const payment = makePayment('PAGO');
    const store = {
      claimEvent: jest.fn().mockResolvedValue(true),
      claimRefund: jest.fn()
        .mockResolvedValueOnce({ idempotencyKey: 'refund:pag-1', fencingToken: 'fence-1' })
        .mockResolvedValueOnce(null),
      refundCompleted: jest.fn().mockResolvedValue(false),
      completeRefund: jest.fn().mockResolvedValue(undefined),
      completeSaga: jest.fn().mockResolvedValue(true),
      markSagaPublished: jest.fn().mockResolvedValue(undefined),
      recordEvidence: jest.fn(),
    };
    const refund = { refund: jest.fn().mockResolvedValue(undefined) };
    const service = new SagaCompensationService(
      { closeWithoutExecution: jest.fn() },
      { releaseByOrdemId: jest.fn().mockResolvedValue(0) } as never,
      { findByOrdemServicoId: jest.fn().mockResolvedValue(payment), save: jest.fn() } as never,
      refund,
      { emitir: jest.fn() },
      store
    );
    const event = new EtapaDaSagaFalhou('os-1', 'inicio-execucao', 'timeout', 'failed-1');

    const results = await Promise.allSettled([service.compensate(event), service.compensate(event)]);

    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(refund.refund).toHaveBeenCalledTimes(1);
  });

  it('retries completion publication after a crash and keeps the saga identity', async () => {
    const payment = makePayment('AGUARDANDO_PAGAMENTO');
    const store = {
      claimEvent: jest.fn().mockResolvedValue(true),
      completeSaga: jest.fn().mockResolvedValue(true),
      markSagaPublished: jest.fn().mockRejectedValueOnce(new Error('crash')).mockResolvedValue(undefined),
    };
    const emitted: SagaCompleted[] = [];
    const service = new SagaCompensationService(
      { closeWithoutExecution: jest.fn() },
      { releaseByOrdemId: jest.fn().mockResolvedValue(0) } as never,
      { findByOrdemServicoId: jest.fn().mockResolvedValue(payment), save: jest.fn() } as never,
      { refund: jest.fn() },
      { emitir: jest.fn(async (event: SagaCompleted) => void emitted.push(event)) },
      store as never
    );
    const event = new EtapaDaSagaFalhou('os-1', 'aprovacao-pagamento', 'timeout', 'failed-1');

    await expect(service.compensate(event)).rejects.toThrow('crash');
    await service.compensate(event);

    expect(emitted).toHaveLength(2);
    expect(emitted[1].eventId).toBe(emitted[0].eventId);
  });

  it('does not publish a second completion when the order is already completed', async () => {
    const store = {
      claimEvent: jest.fn().mockResolvedValue(true),
      completeSaga: jest.fn().mockResolvedValue(false),
    };
    const emit = jest.fn();
    const service = new SagaCompensationService(
      { closeWithoutExecution: jest.fn() },
      { releaseByOrdemId: jest.fn().mockResolvedValue(0) } as never,
      { findByOrdemServicoId: jest.fn().mockResolvedValue(undefined) } as never,
      { refund: jest.fn() },
      { emitir: emit },
      store as never
    );

    await service.compensateRefusal('os-1', 'OrcamentoRecusado', 'event-2');

    expect(store.completeSaga).toHaveBeenCalledWith('os-1', 'event-2', ['os-fechada']);
    expect(emit).not.toHaveBeenCalled();
  });
});
