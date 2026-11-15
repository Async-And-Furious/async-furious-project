import { Logger } from '@nestjs/common';
import { StatusAtualizadoEncerradaSemExecucao } from '../../src/modules/ordem-servico/domain/events/status-atualizado-encerrada-sem-execucao.event';
import { MOTIVO_PAGAMENTO_RECUSADO } from '../../src/modules/ordem-servico/application/event-handlers/atualizar-status-encerrada-sem-execucao.handler';
import {
  BILLING_TOPIC,
  EXECUCAO_TOPIC,
  OS_DLT_TOPIC,
} from '../../src/shared/infrastructure/mensageria/kafka.config';
import { OS_ID, montarSagaEmMemoria } from '../support/saga-em-memoria';

// Lado do OS na matriz `etapa → falha → compensação` (`saga-flow.md` §3, #338), com os handlers
// reais: fechar a OS (só antes do reparo), registrar o motivo e devolver as peças reservadas.

const falha = (etapa: string, servicoOrigem = 'billing-service') => ({
  servicoOrigem,
  eventTypeOriginal: 'OrcamentoCalculado',
  etapa,
  motivo: 'retry esgotado',
});

const encerramentos = (t: ReturnType<typeof montarSagaEmMemoria>) =>
  t.emissor.emitir.mock.calls.filter(
    ([evento]) => evento instanceof StatusAtualizadoEncerradaSemExecucao
  ).length;

describe('Compensação da saga no OS Service (#338)', () => {
  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('PagamentoRecusado', () => {
    it('fecha a OS e devolve as peças reservadas; a reentrega não devolve em dobro', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' }, { reservas: 2 });

      await t.consumir('PagamentoRecusado', { pagamentoId: 'pag-1' }, BILLING_TOPIC);
      await t.consumir('PagamentoRecusado', { pagamentoId: 'pag-1' }, BILLING_TOPIC);

      expect(t.estado()?.status).toBe('CLOSED_WITHOUT_EXECUTION');
      expect(t.historico.map((linha) => linha.motivo)).toEqual([MOTIVO_PAGAMENTO_RECUSADO]);
      expect(t.reservasDevolvidas()).toBe(2);
      expect(t.reservasPendentes()).toBe(0);
      expect(encerramentos(t)).toBe(1);
    });

    it('com o reparo em andamento, não devolve as peças', async () => {
      const t = montarSagaEmMemoria({ status: 'IN_PROGRESS' }, { reservas: 2 });

      await t.consumir('PagamentoRecusado', { pagamentoId: 'pag-1' }, BILLING_TOPIC);

      expect(t.estado()?.status).toBe('IN_PROGRESS');
      expect(t.reservasDevolvidas()).toBe(0);
    });
  });

  describe('EtapaDaSagaFalhou recebida do Billing e do Execução', () => {
    it.each([
      ['diagnostico', 'execucao-service', EXECUCAO_TOPIC, 'UNDER_DIAGNOSIS'],
      ['orcamento', 'billing-service', BILLING_TOPIC, 'UNDER_DIAGNOSIS'],
      ['aprovacao-pagamento', 'billing-service', BILLING_TOPIC, 'AWAITING_APPROVAL'],
      ['inicio-execucao', 'execucao-service', EXECUCAO_TOPIC, 'AWAITING_APPROVAL'],
    ] as const)(
      'etapa=%s (%s): fecha a OS com o motivo e devolve as peças, uma vez só',
      async (etapa, origem, topico, status) => {
        const t = montarSagaEmMemoria({ status }, { reservas: 3 });

        await t.consumir('EtapaDaSagaFalhou', falha(etapa, origem), topico);
        await t.consumir('EtapaDaSagaFalhou', falha(etapa, origem), topico);

        expect(t.estado()?.status).toBe('CLOSED_WITHOUT_EXECUTION');
        expect(t.historico).toHaveLength(1);
        expect(t.historico[0].motivo).toBe(
          `Falha técnica na etapa ${etapa} (${origem}): retry esgotado`
        );
        expect(t.reservasDevolvidas()).toBe(3);
        expect(encerramentos(t)).toBe(1);
        expect(t.enviar).not.toHaveBeenCalled();
      }
    );

    it.each(['IN_PROGRESS', 'AWAITING_PARTS'] as const)(
      'com a OS em %s, só registra o motivo, sem fechar nem devolver peças',
      async (status) => {
        const t = montarSagaEmMemoria({ status }, { reservas: 3 });

        await t.consumir('EtapaDaSagaFalhou', falha('aprovacao-pagamento'), BILLING_TOPIC);
        await t.consumir('EtapaDaSagaFalhou', falha('aprovacao-pagamento'), BILLING_TOPIC);

        expect(t.estado()?.status).toBe(status);
        expect(t.historico).toHaveLength(1);
        expect(t.reservasDevolvidas()).toBe(0);
      }
    );

    it('etapa=reparo não compensa: só o motivo fica no histórico', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' }, { reservas: 3 });

      await t.consumir('EtapaDaSagaFalhou', falha('reparo', 'execucao-service'), EXECUCAO_TOPIC);

      expect(t.estado()?.status).toBe('AWAITING_APPROVAL');
      expect(t.historico).toHaveLength(1);
      expect(t.historico[0].motivo).toContain('etapa reparo');
      expect(t.reservasDevolvidas()).toBe(0);
    });

    it.each(['FINISHED', 'DELIVERED'] as const)(
      'já-passou (OS em %s): ack, sem efeito',
      async (status) => {
        const t = montarSagaEmMemoria({ status }, { reservas: 3 });

        await t.consumir('EtapaDaSagaFalhou', falha('orcamento'), BILLING_TOPIC);

        expect(t.historico).toHaveLength(0);
        expect(t.reservasDevolvidas()).toBe(0);
        expect(t.enviar).not.toHaveBeenCalled();
      }
    );

    it('devolução que falhou é refeita na reentrega, com a OS já fechada', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' }, { reservas: 2 });
      t.reservaEstoque.releaseByOrdemId.mockRejectedValueOnce(new Error('deadlock'));

      await t.consumir('EtapaDaSagaFalhou', falha('aprovacao-pagamento'), BILLING_TOPIC);
      expect(t.estado()?.status).toBe('CLOSED_WITHOUT_EXECUTION');
      expect(t.reservasPendentes()).toBe(2);

      await t.consumir('EtapaDaSagaFalhou', falha('aprovacao-pagamento'), BILLING_TOPIC);

      expect(t.reservasDevolvidas()).toBe(2);
      expect(t.historico).toHaveLength(1);
    });

    it.each([
      ['sem etapa', { servicoOrigem: 'billing-service', motivo: 'x' }],
      ['etapa desconhecida', { ...falha('pagamento') }],
      ['sem motivo', { servicoOrigem: 'billing-service', etapa: 'orcamento' }],
    ])('irrecuperável (%s): vai direto à DLT, sem efeito', async (_caso, data) => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' }, { reservas: 1 });

      await t.consumir('EtapaDaSagaFalhou', data, BILLING_TOPIC);

      expect(t.topicosEnviados()).toEqual([OS_DLT_TOPIC]);
      expect(t.estado()?.status).toBe('AWAITING_APPROVAL');
      expect(t.reservasDevolvidas()).toBe(0);
    });
  });

  describe('falha na própria DLT do OS', () => {
    it('publica EtapaDaSagaFalhou e aplica a compensação local no mesmo ato', async () => {
      const t = montarSagaEmMemoria({ status: 'AWAITING_APPROVAL' }, { reservas: 2 });

      await t.processador.processar(
        OS_DLT_TOPIC,
        OS_ID,
        JSON.stringify({
          eventType: 'OrcamentoAprovado',
          data: { ordemServicoId: OS_ID },
          lastError: 'deadlock',
        })
      );

      expect(t.publicador.publicar).toHaveBeenCalledTimes(1);
      expect(t.estado()?.status).toBe('CLOSED_WITHOUT_EXECUTION');
      expect(t.historico[0].motivo).toBe(
        'Falha técnica na etapa aprovacao-pagamento (os-service): deadlock'
      );
      expect(t.reservasDevolvidas()).toBe(2);
    });
  });
});
