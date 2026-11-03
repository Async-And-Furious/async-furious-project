import { Logger } from '@nestjs/common';
import { EtapaDaSagaFalhou } from '../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';
import {
  OS_DLT_TOPIC,
  OS_RETRY_TOPIC,
} from '../../src/shared/infrastructure/mensageria/kafka.config';
import { montarSagaEmMemoria } from '../support/saga-em-memoria';

describe('Consumo de execucao.eventos.v1 com os handlers reais', () => {
  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('DiagnosticoIniciado', () => {
    it('leva RECEIVED a UNDER_DIAGNOSIS; reprocessar a mesma mensagem não muda nada', async () => {
      const t = montarSagaEmMemoria({ status: 'RECEIVED' });

      await t.consumir('DiagnosticoIniciado');
      await t.consumir('DiagnosticoIniciado');

      expect(t.estado()?.status).toBe('UNDER_DIAGNOSIS');
      expect(t.emissor.emitir).toHaveBeenCalledTimes(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('já-passou (OS em AWAITING_APPROVAL): ack sem gravar', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('DiagnosticoIniciado');

      expect(t.estado()?.status).toBe('AWAITING_APPROVAL');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (OS inexistente): vai direto à DLT', async () => {
      const t = montarSagaEmMemoria(null);

      await t.consumir('DiagnosticoIniciado');

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
    });
  });

  describe('ExecucaoIniciada', () => {
    it('leva AWAITING_APPROVAL a IN_PROGRESS; reprocessar não emite o início de novo', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('ExecucaoIniciada');
      // Na reentrega a OS já está em IN_PROGRESS, com iniciada_em gravado: nada acontece.
      await t.consumir('ExecucaoIniciada');

      expect(t.estado()?.status).toBe('IN_PROGRESS');
      expect(t.emissor.emitir).toHaveBeenCalledTimes(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('ainda-não (OS em UNDER_DIAGNOSIS): vai ao retry topic, sem gravar', async () => {
      const t = montarSagaEmMemoria({ status: 'UNDER_DIAGNOSIS' });

      await t.consumir('ExecucaoIniciada');

      expect(t.estado()?.status).toBe('UNDER_DIAGNOSIS');
      expect(t.topicosEnviados()).toEqual([OS_RETRY_TOPIC]);
    });

    it('já-passou (OS FINISHED): ack sem gravar', async () => {
      const t = montarSagaEmMemoria({ status: 'FINISHED', iniciadaEm: new Date() });

      await t.consumir('ExecucaoIniciada');

      expect(t.estado()?.status).toBe('FINISHED');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (OS inexistente): vai direto à DLT', async () => {
      const t = montarSagaEmMemoria(null);

      await t.consumir('ExecucaoIniciada');

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
    });
  });

  describe('ExecucaoConcluida', () => {
    it('leva IN_PROGRESS a FINISHED; reprocessar não grava nem emite de novo', async () => {
      const t = montarSagaEmMemoria({ status: 'IN_PROGRESS', iniciadaEm: new Date() });

      await t.consumir('ExecucaoConcluida');
      await t.consumir('ExecucaoConcluida');

      expect(t.estado()?.status).toBe('FINISHED');
      expect(t.emissor.emitir).toHaveBeenCalledTimes(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('ainda-não (OS em AWAITING_APPROVAL): vai ao retry topic', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('ExecucaoConcluida');

      expect(t.topicosEnviados()).toEqual([OS_RETRY_TOPIC]);
    });

    it('irrecuperável de negócio (OS em AWAITING_PARTS): sinaliza EtapaDaSagaFalhou uma vez, sem retry', async () => {
      const t = montarSagaEmMemoria({
        status: 'AWAITING_PARTS',
        reserva: true,
        iniciadaEm: new Date(),
      });

      await t.consumir('ExecucaoConcluida');
      await t.consumir('ExecucaoConcluida');

      const falhas = t.emissor.emitir.mock.calls.filter(
        ([evento]) => evento instanceof EtapaDaSagaFalhou
      );
      expect(falhas).toHaveLength(1);
      expect(t.historico).toHaveLength(1);
      expect(t.estado()?.status).toBe('AWAITING_PARTS');
      expect(t.enviar).not.toHaveBeenCalled();
    });
  });
});
