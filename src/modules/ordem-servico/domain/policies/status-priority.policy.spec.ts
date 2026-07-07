import {
  STATUS_PRIORIDADE,
  STATUS_EXCLUIDOS_DA_LISTAGEM,
  getPrioridadeStatus,
} from './status-priority.policy';

describe('StatusPriorityPolicy', () => {
  describe('getPrioridadeStatus', () => {
    it('deve retornar IN_PROGRESS como maior prioridade (menor número)', () => {
      expect(getPrioridadeStatus('IN_PROGRESS')).toBe(1);
    });

    it('deve ordenar por prioridade: IN_PROGRESS < AWAITING_APPROVAL < UNDER_DIAGNOSIS < RECEIVED', () => {
      expect(getPrioridadeStatus('IN_PROGRESS')).toBeLessThan(
        getPrioridadeStatus('AWAITING_APPROVAL')
      );
      expect(getPrioridadeStatus('AWAITING_APPROVAL')).toBeLessThan(
        getPrioridadeStatus('UNDER_DIAGNOSIS')
      );
      expect(getPrioridadeStatus('UNDER_DIAGNOSIS')).toBeLessThan(getPrioridadeStatus('RECEIVED'));
    });

    it('deve retornar FINISHED e DELIVERED com prioridade mais baixa que os operacionais', () => {
      const operacionais = [
        'IN_PROGRESS',
        'AWAITING_APPROVAL',
        'UNDER_DIAGNOSIS',
        'RECEIVED',
      ] as const;
      for (const status of operacionais) {
        expect(getPrioridadeStatus(status)).toBeLessThan(getPrioridadeStatus('FINISHED'));
        expect(getPrioridadeStatus(status)).toBeLessThan(getPrioridadeStatus('DELIVERED'));
      }
    });
  });

  describe('STATUS_EXCLUIDOS_DA_LISTAGEM', () => {
    it('deve excluir FINISHED e DELIVERED', () => {
      expect(STATUS_EXCLUIDOS_DA_LISTAGEM).toContain('FINISHED');
      expect(STATUS_EXCLUIDOS_DA_LISTAGEM).toContain('DELIVERED');
    });

    it('não deve excluir os status operacionais', () => {
      expect(STATUS_EXCLUIDOS_DA_LISTAGEM).not.toContain('IN_PROGRESS');
      expect(STATUS_EXCLUIDOS_DA_LISTAGEM).not.toContain('AWAITING_APPROVAL');
      expect(STATUS_EXCLUIDOS_DA_LISTAGEM).not.toContain('UNDER_DIAGNOSIS');
      expect(STATUS_EXCLUIDOS_DA_LISTAGEM).not.toContain('RECEIVED');
    });
  });

  describe('STATUS_PRIORIDADE', () => {
    it('deve ter entrada para todos os status do enum', () => {
      const allStatuses = [
        'RECEIVED',
        'UNDER_DIAGNOSIS',
        'AWAITING_APPROVAL',
        'IN_PROGRESS',
        'AWAITING_PARTS',
        'FINISHED',
        'DELIVERED',
        'CLOSED_WITHOUT_EXECUTION',
      ];
      for (const status of allStatuses) {
        expect(STATUS_PRIORIDADE).toHaveProperty(status);
      }
    });
  });
});
