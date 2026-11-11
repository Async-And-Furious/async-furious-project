import path from 'node:path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { AmbienteSaga } from '../support/ambiente-saga';

// Cenário com @depende-338 fica pulado pela tag (e segue no arquivo): ver test/bdd/README.md.
const feature = loadFeature(path.join(__dirname, '..', 'features', 'fluxo-saga-os.feature'), {
  tagFilter: 'not @depende-338',
});

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

  // Passos definidos e pulados: o cenário segue o .feature (a validação do jest-cucumber exige
  // os passos), mas nenhum roda até a #338. Remover o `pending` junto com a tag @depende-338.
  test('Pagamento recusado compensa a saga até CLOSED_WITHOUT_EXECUTION', ({
    given,
    when,
    then,
    and,
    pending,
  }) => {
    given('que o OS Service está no ar com o banco de teste', () => pending());
    and(
      'que o Billing Service e a Execução e Produção são simulados por eventos entregues ao consumidor da saga',
      () => pending()
    );
    given('que a OS está em AWAITING_APPROVAL com o Orcamento em PENDING', () => pending());
    and('que as peças do orçamento estão em estoque', () => pending());
    when('o cliente aprova o orçamento (PATCH /api/v1/orcamentos/{ordemServicoId}/aprovar)', () =>
      pending()
    );
    then('a resposta contém linkPagamento', () => pending());
    and('as peças da OS são reservadas', () => pending());
    when(
      'o Mercado Pago notifica o pagamento recusado (POST /api/v1/webhooks/mercado-pago, com assinatura válida) e a reconsulta devolve rejected',
      () => pending()
    );
    then('o Pagamento está em RECUSADO', () => pending());
    and('o evento PagamentoRecusado é publicado em billing.eventos.v1', () => pending());
    and('a reserva de peças da OS é liberada', () => pending());
    and('a OS está em CLOSED_WITHOUT_EXECUTION', () => pending());
    and('o HistoricoStatusOS registra o motivo "pagamento recusado"', () => pending());
    and('a Execucao está em CANCELADA', () => pending());
    and('o Mercado Pago não recebe nenhum estorno, porque nada foi capturado', () => pending());
  });
});
