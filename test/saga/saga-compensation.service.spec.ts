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
});
