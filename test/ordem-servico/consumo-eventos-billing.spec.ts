import { Logger } from '@nestjs/common';
import { OrcamentoAprovadoComPecas } from '../../src/modules/ordem-servico/domain/events/orcamento-aprovado-com-pecas.event';
import { StatusAtualizadoEncerradaSemExecucao } from '../../src/modules/ordem-servico/domain/events/status-atualizado-encerrada-sem-execucao.event';
import { MOTIVO_PAGAMENTO_CONFIRMADO } from '../../src/modules/ordem-servico/application/event-handlers/registrar-pagamento-confirmado.handler';
import {
  OS_DLT_TOPIC,
  OS_RETRY_TOPIC,
} from '../../src/shared/infrastructure/mensageria/kafka.config';
import { montarSagaEmMemoria } from '../support/saga-em-memoria';

const ORCAMENTO = { orcamentoId: 'orc-1' };
const APROVADO = { orcamentoId: 'orc-1', valorTotalPecas: 320.5 };
const PAGAMENTO = { pagamentoId: 'pag-1' };

const emitidos = (t: ReturnType<typeof montarSagaEmMemoria>, tipo: new (...a: never[]) => object) =>
  t.emissor.emitir.mock.calls.filter(([evento]) => evento instanceof tipo).length;

describe('Consumo de billing.eventos.v1 com os handlers reais', () => {
  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('OrcamentoGerado', () => {
    it('leva UNDER_DIAGNOSIS a AWAITING_APPROVAL; reprocessar não muda nada', async () => {
      const t = montarSagaEmMemoria({ status: 'UNDER_DIAGNOSIS' });

      await t.consumir('OrcamentoGerado', ORCAMENTO);
      await t.consumir('OrcamentoGerado', ORCAMENTO);

      expect(t.estado()?.status).toBe('AWAITING_APPROVAL');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('ainda-não (OS em RECEIVED): vai ao retry topic', async () => {
      const t = montarSagaEmMemoria({ status: 'RECEIVED' });

      await t.consumir('OrcamentoGerado', ORCAMENTO);

      expect(t.estado()?.status).toBe('RECEIVED');
      expect(t.topicosEnviados()).toEqual([OS_RETRY_TOPIC]);
    });

    it('já-passou (OS em IN_PROGRESS): ack sem gravar', async () => {
      const t = montarSagaEmMemoria({ status: 'IN_PROGRESS' });

      await t.consumir('OrcamentoGerado', ORCAMENTO);

      expect(t.estado()?.status).toBe('IN_PROGRESS');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (payload sem orcamentoId): vai direto à DLT', async () => {
      const t = montarSagaEmMemoria({ status: 'UNDER_DIAGNOSIS' });

      await t.consumir('OrcamentoGerado');

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
      expect(t.estado()?.status).toBe('UNDER_DIAGNOSIS');
    });
  });

  describe('OrcamentoAprovado', () => {
    it('pede a reserva das peças uma vez só, sem mudar o status, mesmo reprocessado', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('OrcamentoAprovado', APROVADO);
      await t.consumir('OrcamentoAprovado', APROVADO);

      expect(emitidos(t, OrcamentoAprovadoComPecas)).toBe(1);
      expect(t.historico).toHaveLength(1);
      expect(t.estado()?.status).toBe('AWAITING_APPROVAL');
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('ainda-não (OS em UNDER_DIAGNOSIS): vai ao retry topic, sem reservar', async () => {
      const t = montarSagaEmMemoria({ status: 'UNDER_DIAGNOSIS' });

      await t.consumir('OrcamentoAprovado', APROVADO);

      expect(emitidos(t, OrcamentoAprovadoComPecas)).toBe(0);
      expect(t.topicosEnviados()).toEqual([OS_RETRY_TOPIC]);
    });

    it('já-passou (OS CLOSED_WITHOUT_EXECUTION): não reserva', async () => {
      const t = montarSagaEmMemoria({ status: 'CLOSED_WITHOUT_EXECUTION' });

      await t.consumir('OrcamentoAprovado', APROVADO);

      expect(emitidos(t, OrcamentoAprovadoComPecas)).toBe(0);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (valorTotalPecas não numérico): vai direto à DLT', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('OrcamentoAprovado', { orcamentoId: 'orc-1', valorTotalPecas: '320.50' });

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
    });
  });

  describe.each([
    ['OrcamentoRecusado', ORCAMENTO],
    ['PagamentoRecusado', PAGAMENTO],
  ])('%s', (eventType, data) => {
    it('fecha a OS em AWAITING_APPROVAL; reprocessar não fecha nem emite de novo', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir(eventType, data);
      await t.consumir(eventType, data);

      expect(t.estado()?.status).toBe('CLOSED_WITHOUT_EXECUTION');
      expect(emitidos(t, StatusAtualizadoEncerradaSemExecucao)).toBe(1);
      expect(t.historico).toHaveLength(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('com o reparo em andamento (IN_PROGRESS) só registra o motivo, uma vez', async () => {
      const t = montarSagaEmMemoria({ status: 'IN_PROGRESS' });

      await t.consumir(eventType, data);
      await t.consumir(eventType, data);

      expect(t.estado()?.status).toBe('IN_PROGRESS');
      expect(t.historico).toHaveLength(1);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('já-passou (OS FINISHED): ack sem gravar', async () => {
      const t = montarSagaEmMemoria({ status: 'FINISHED' });

      await t.consumir(eventType, data);

      expect(t.historico).toHaveLength(0);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (OS inexistente): vai direto à DLT', async () => {
      const t = montarSagaEmMemoria(null);

      await t.consumir(eventType, data);

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
    });
  });

  describe('PagamentoConfirmado', () => {
    it('grava pago_em e uma linha de histórico sem mudar o status; reprocessar não sobrescreve', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('PagamentoConfirmado', PAGAMENTO);
      const pagoEm = t.estado()?.pagoEm;
      await t.consumir('PagamentoConfirmado', PAGAMENTO);

      expect(pagoEm).toBeInstanceOf(Date);
      expect(t.estado()?.pagoEm).toBe(pagoEm);
      expect(t.estado()?.status).toBe('AWAITING_APPROVAL');
      expect(t.historico).toHaveLength(1);
      expect(t.historico[0].motivo).toBe(`${MOTIVO_PAGAMENTO_CONFIRMADO} (pagamento pag-1)`);
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('com o reparo já iniciado (ExecucaoIniciada chegou antes) ainda registra o pagamento', async () => {
      const t = montarSagaEmMemoria({ status: 'IN_PROGRESS' });

      await t.consumir('PagamentoConfirmado', PAGAMENTO);

      expect(t.estado()?.pagoEm).toBeInstanceOf(Date);
      expect(t.estado()?.status).toBe('IN_PROGRESS');
    });

    it('ainda-não (OS em UNDER_DIAGNOSIS): vai ao retry topic', async () => {
      const t = montarSagaEmMemoria({ status: 'UNDER_DIAGNOSIS' });

      await t.consumir('PagamentoConfirmado', PAGAMENTO);

      expect(t.estado()?.pagoEm).toBeNull();
      expect(t.topicosEnviados()).toEqual([OS_RETRY_TOPIC]);
    });

    it('já-passou (OS CLOSED_WITHOUT_EXECUTION): ack sem gravar', async () => {
      const t = montarSagaEmMemoria({ status: 'CLOSED_WITHOUT_EXECUTION' });

      await t.consumir('PagamentoConfirmado', PAGAMENTO);

      expect(t.estado()?.pagoEm).toBeNull();
      expect(t.enviar).not.toHaveBeenCalled();
    });

    it('irrecuperável (payload sem pagamentoId): vai direto à DLT', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' });

      await t.consumir('PagamentoConfirmado');

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
    });
  });
});
