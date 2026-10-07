import { EtapaDaSagaFalhou, SagaCompleted } from '../../src/shared/domain/events/saga-compensation.events';

describe('Saga event contracts', () => {
  it('keeps correlation and compensation data explicit', () => {
    const failed = new EtapaDaSagaFalhou('os-1', 'aprovacao-pagamento', 'deadline', 'evt-1');
    const completed = new SagaCompleted('os-1', ['os-fechada', 'reserva-liberada']);

    expect(failed).toMatchObject({
      ordemServicoId: 'os-1',
      etapa: 'aprovacao-pagamento',
      motivo: 'deadline',
      eventIdOriginal: 'evt-1',
    });
    expect(completed).toMatchObject({
      ordemServicoId: 'os-1',
      compensacoes: ['os-fechada', 'reserva-liberada'],
    });
  });
});
