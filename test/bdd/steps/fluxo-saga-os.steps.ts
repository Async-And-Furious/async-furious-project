import path from 'node:path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { AmbienteSaga } from '../support/ambiente-saga';

const feature = loadFeature(path.join(__dirname, '..', 'features', 'fluxo-saga-os.feature'));

const ESTOQUE_INICIAL = 5;
const PAGAMENTO_ID = 'pagamento-bdd-1';
const ORCAMENTO_ID = 'orcamento-bdd-1';

let ambiente: AmbienteSaga | undefined;

const saga = (): AmbienteSaga => {
  if (!ambiente) throw new Error('o ambiente do cenário não subiu (falta o passo de contexto)');
  return ambiente;
};

afterEach(async () => {
  if (ambiente) {
    const encerrando = ambiente;
    ambiente = undefined;
    await encerrando.encerrar();
  }
});

defineFeature(feature, (test) => {
  test('Ordem de Serviço percorre a saga do recebimento até FINISHED', ({
    given,
    when,
    then,
    and,
  }) => {
    let idPeca = '';
    let osId = '';

    given('que o OS Service está no ar com o banco de teste', async () => {
      ambiente = await AmbienteSaga.subir();
    });
    and(
      'que o Billing Service e a Execução e Produção são simulados por eventos entregues ao consumidor da saga',
      () => {
        saga().conectarConsumidorSimulado();
      }
    );

    given('que as peças do orçamento estão em estoque', async () => {
      idPeca = await saga().criarPecaEmEstoque(ESTOQUE_INICIAL);
    });

    when('a recepcionista abre a Ordem de Serviço (POST /api/v1/ordens-servico)', async () => {
      osId = await saga().abrirOs(idPeca);
    });
    then('a OS está em RECEIVED', async () => {
      expect(await saga().statusDaOs(osId)).toBe('RECEIVED');
    });
    and('o evento OrdemServicoRecebida é publicado em os.eventos.v1', () => {
      expect(saga().publicadosPelaOs()).toContain('OrdemServicoRecebida');
    });

    when('a Execução publica DiagnosticoIniciado', async () => {
      await saga().entregar('execucao', osId, 'DiagnosticoIniciado');
    });
    then('a OS está em UNDER_DIAGNOSIS', async () => {
      expect(await saga().statusDaOs(osId)).toBe('UNDER_DIAGNOSIS');
    });

    when(
      'o mecânico define os serviços e as peças (PATCH /api/v1/ordens-servico/{id}/servicos-insumos)',
      async () => {
        await saga().lancarServicosInsumos(osId, {
          valor_total_servicos: 300,
          valor_total_pecas: 60,
        });
      }
    );
    then('o evento OrcamentoCalculado é publicado em os.eventos.v1', () => {
      expect(saga().publicadosPelaOs()).toContain('OrcamentoCalculado');
    });

    when('o Billing publica OrcamentoGerado', async () => {
      await saga().entregar('billing', osId, 'OrcamentoGerado', { orcamentoId: ORCAMENTO_ID });
    });
    then('a OS está em AWAITING_APPROVAL', async () => {
      expect(await saga().statusDaOs(osId)).toBe('AWAITING_APPROVAL');
    });

    when('o Billing publica OrcamentoAprovado', async () => {
      await saga().entregar('billing', osId, 'OrcamentoAprovado', {
        orcamentoId: ORCAMENTO_ID,
        valorTotalPecas: 60,
      });
    });
    then('as peças da OS são reservadas', async () => {
      expect(await saga().estoqueDaPeca(idPeca)).toBe(ESTOQUE_INICIAL - 1);
    });
    and('a OS continua em AWAITING_APPROVAL', async () => {
      expect(await saga().statusDaOs(osId)).toBe('AWAITING_APPROVAL');
    });

    when('o Billing publica PagamentoConfirmado', async () => {
      await saga().entregar('billing', osId, 'PagamentoConfirmado', {
        pagamentoId: PAGAMENTO_ID,
      });
    });
    then('a OS registra pago_em e continua em AWAITING_APPROVAL', async () => {
      expect((await saga().ordemDaOs(osId)).pago_em).not.toBeNull();
      expect(await saga().statusDaOs(osId)).toBe('AWAITING_APPROVAL');
    });

    when('a Execução publica ExecucaoIniciada', async () => {
      await saga().entregar('execucao', osId, 'ExecucaoIniciada');
    });
    then('a OS está em IN_PROGRESS', async () => {
      expect(await saga().statusDaOs(osId)).toBe('IN_PROGRESS');
    });

    when('a Execução publica ExecucaoConcluida', async () => {
      await saga().entregar('execucao', osId, 'ExecucaoConcluida');
    });
    then('a OS está em FINISHED', async () => {
      expect(await saga().statusDaOs(osId)).toBe('FINISHED');
    });
  });

  // Contexto e preparação comuns aos cenários de compensação (#338).
  const prepararAteAguardarAprovacao = (
    given: (texto: string, passo: () => unknown) => void,
    and: (texto: string, passo: () => unknown) => void,
    estado: { idPeca: string; osId: string }
  ): void => {
    given('que o OS Service está no ar com o banco de teste', async () => {
      ambiente = await AmbienteSaga.subir();
    });
    and(
      'que o Billing Service e a Execução e Produção são simulados por eventos entregues ao consumidor da saga',
      () => {
        saga().conectarConsumidorSimulado();
      }
    );
    given('que as peças do orçamento estão em estoque', async () => {
      estado.idPeca = await saga().criarPecaEmEstoque(ESTOQUE_INICIAL);
    });
    and('que a OS chegou a AWAITING_APPROVAL', async () => {
      estado.osId = await saga().abrirOs(estado.idPeca);
      await saga().entregar('execucao', estado.osId, 'DiagnosticoIniciado');
      await saga().lancarServicosInsumos(estado.osId, {
        valor_total_servicos: 300,
        valor_total_pecas: 60,
      });
      await saga().entregar('billing', estado.osId, 'OrcamentoGerado', {
        orcamentoId: ORCAMENTO_ID,
      });
      expect(await saga().statusDaOs(estado.osId)).toBe('AWAITING_APPROVAL');
    });
  };

  const aprovarEReservar = (
    when: (texto: string, passo: () => unknown) => void,
    then: (texto: string, passo: () => unknown) => void,
    estado: { idPeca: string; osId: string }
  ): void => {
    when('o Billing publica OrcamentoAprovado', async () => {
      await saga().entregar('billing', estado.osId, 'OrcamentoAprovado', {
        orcamentoId: ORCAMENTO_ID,
        valorTotalPecas: 60,
      });
    });
    then('as peças da OS são reservadas', async () => {
      expect(await saga().estoqueDaPeca(estado.idPeca)).toBe(ESTOQUE_INICIAL - 1);
    });
  };

  test('Pagamento recusado compensa a saga até CLOSED_WITHOUT_EXECUTION', ({
    given,
    when,
    then,
    and,
  }) => {
    const estado = { idPeca: '', osId: '' };
    prepararAteAguardarAprovacao(given, and, estado);
    aprovarEReservar(when, then, estado);

    when('o Billing publica PagamentoRecusado', async () => {
      await saga().entregar('billing', estado.osId, 'PagamentoRecusado', {
        pagamentoId: PAGAMENTO_ID,
      });
    });
    then('a OS está em CLOSED_WITHOUT_EXECUTION', async () => {
      expect(await saga().statusDaOs(estado.osId)).toBe('CLOSED_WITHOUT_EXECUTION');
    });
    and('as peças reservadas voltam ao estoque', async () => {
      expect(await saga().estoqueDaPeca(estado.idPeca)).toBe(ESTOQUE_INICIAL);
    });
    and(/^o HistoricoStatusOS registra o motivo "(.*)"$/, async (motivo: string) => {
      expect(await saga().motivosDoHistorico(estado.osId)).toContain(motivo);
    });

    when('o Billing publica PagamentoRecusado de novo', async () => {
      await saga().entregar('billing', estado.osId, 'PagamentoRecusado', {
        pagamentoId: PAGAMENTO_ID,
      });
    });
    then('as peças não voltam ao estoque em dobro', async () => {
      expect(await saga().estoqueDaPeca(estado.idPeca)).toBe(ESTOQUE_INICIAL);
      expect(await saga().statusDaOs(estado.osId)).toBe('CLOSED_WITHOUT_EXECUTION');
    });
  });

  test('Falha técnica no início da execução compensa a saga até CLOSED_WITHOUT_EXECUTION', ({
    given,
    when,
    then,
    and,
  }) => {
    const estado = { idPeca: '', osId: '' };
    prepararAteAguardarAprovacao(given, and, estado);
    aprovarEReservar(when, then, estado);

    when('a Execução publica EtapaDaSagaFalhou com etapa inicio-execucao', async () => {
      await saga().entregar('execucao', estado.osId, 'EtapaDaSagaFalhou', {
        servicoOrigem: 'execucao-service',
        eventTypeOriginal: 'PagamentoConfirmado',
        etapa: 'inicio-execucao',
        motivo: 'retry esgotado',
      });
    });
    then('a OS está em CLOSED_WITHOUT_EXECUTION', async () => {
      expect(await saga().statusDaOs(estado.osId)).toBe('CLOSED_WITHOUT_EXECUTION');
    });
    and('as peças reservadas voltam ao estoque', async () => {
      expect(await saga().estoqueDaPeca(estado.idPeca)).toBe(ESTOQUE_INICIAL);
    });
    and(/^o HistoricoStatusOS registra o motivo "(.*)"$/, async (motivo: string) => {
      expect(await saga().motivosDoHistorico(estado.osId)).toContain(motivo);
    });
  });
});
