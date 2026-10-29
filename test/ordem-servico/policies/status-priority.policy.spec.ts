import {
  STATUS_EXCLUIDOS_DA_LISTAGEM,
  STATUS_PRIORIDADE,
  getPrioridadeStatus,
} from '../../../src/modules/ordem-servico/domain/policies/status-priority.policy';
import type { OSStatus } from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';

describe('status-priority policy', () => {
  it('orders in-progress work before the statuses that wait on someone else', () => {
    expect(getPrioridadeStatus('IN_PROGRESS')).toBe(1);
    expect(getPrioridadeStatus('AWAITING_APPROVAL')).toBeLessThan(
      getPrioridadeStatus('UNDER_DIAGNOSIS')
    );
    expect(getPrioridadeStatus('DELIVERED')).toBe(8);
  });

  it('gives every known status a distinct priority', () => {
    const priorities = Object.values(STATUS_PRIORIDADE);

    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('ranks an unknown status after every known one', () => {
    const unknown = 'STATUS_INEXISTENTE' as unknown as OSStatus;

    expect(getPrioridadeStatus(unknown)).toBe(9);
    expect(getPrioridadeStatus(unknown)).toBeGreaterThan(
      Math.max(...Object.values(STATUS_PRIORIDADE))
    );
  });

  it('hides finished, delivered and closed-without-execution orders from the work list', () => {
    expect(STATUS_EXCLUIDOS_DA_LISTAGEM).toEqual([
      'FINISHED',
      'DELIVERED',
      'CLOSED_WITHOUT_EXECUTION',
    ]);
  });
});
