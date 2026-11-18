import { HistoricoStatus } from '../../../src/modules/ordem-servico/domain/entities/historico-status.entity';

describe('HistoricoStatus', () => {
  const base = {
    ordemServicoId: 'os-1',
    statusAnterior: 'RECEIVED' as const,
    statusNovo: 'UNDER_DIAGNOSIS' as const,
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the reason when one is given', () => {
    const historico = HistoricoStatus.create({ ...base, motivo: 'Cliente chegou cedo' });

    expect(historico.motivo).toBe('Cliente chegou cedo');
  });

  it('records no reason as null when the transition has no motivo', () => {
    const historico = HistoricoStatus.create(base);

    expect(historico.motivo).toBeNull();
  });

  it('uses the given moment when one is provided', () => {
    const momento = new Date('2026-10-01T10:00:00Z');

    expect(HistoricoStatus.create({ ...base, dataHora: momento }).dataHora).toBe(momento);
  });

  it('stamps the current time when no moment is provided', () => {
    const agora = new Date('2026-10-28T12:00:00Z');
    jest.useFakeTimers().setSystemTime(agora);

    expect(HistoricoStatus.create(base).dataHora).toEqual(agora);
  });
});
