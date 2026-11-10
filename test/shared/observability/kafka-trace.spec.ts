import {
  comTransacaoDeConsumo,
  injetarHeadersTrace,
} from '../../../src/shared/infrastructure/observability/kafka-trace';

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
const mockTransacao = {
  insertDistributedTraceHeaders: jest.fn<void, [Record<string, string>]>(),
  acceptDistributedTraceHeaders: jest.fn<void, [string, Record<string, string>]>(),
};
const mockStartBackgroundTransaction = jest.fn<
  Promise<unknown>,
  [string, string, () => Promise<unknown>]
>();

jest.mock('newrelic', () => ({
  getTransaction: () => mockTransacao,
  startBackgroundTransaction: (nome: string, grupo: string, handle: () => Promise<unknown>) =>
    mockStartBackgroundTransaction(nome, grupo, handle),
}));

describe('kafka-trace com o agente mockado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransacao.insertDistributedTraceHeaders.mockImplementation((headers) => {
      headers.traceparent = TRACEPARENT;
    });
    mockStartBackgroundTransaction.mockImplementation((_nome, _grupo, handle) => handle());
  });

  describe('injetarHeadersTrace', () => {
    it('preenche os headers com o trace da transação ativa', () => {
      expect(injetarHeadersTrace()).toEqual({ traceparent: TRACEPARENT });
    });
  });

  describe('comTransacaoDeConsumo', () => {
    it('abre background transaction com o tópico e aceita os headers convertidos de Buffer para string', async () => {
      await comTransacaoDeConsumo(
        'os.retry.v1',
        {
          traceparent: Buffer.from(TRACEPARENT),
          tracestate: Buffer.from('1@nr=0-0'),
          NewRelic: Buffer.from('payload'),
        },
        () => Promise.resolve()
      );

      expect(mockStartBackgroundTransaction).toHaveBeenCalledWith(
        'os.retry.v1',
        'Kafka',
        expect.any(Function)
      );
      expect(mockTransacao.acceptDistributedTraceHeaders).toHaveBeenCalledWith('Kafka', {
        traceparent: TRACEPARENT,
        tracestate: '1@nr=0-0',
        newrelic: 'payload',
      });
    });

    it('aceita os headers antes de executar o handler', async () => {
      await comTransacaoDeConsumo('execucao.eventos.v1', { traceparent: TRACEPARENT }, () => {
        expect(mockTransacao.acceptDistributedTraceHeaders).toHaveBeenCalledTimes(1);
        return Promise.resolve();
      });
    });

    it('sem headers, aceita um objeto vazio e executa o handler', async () => {
      const handle = jest.fn().mockResolvedValue('ok');

      await expect(comTransacaoDeConsumo('billing.eventos.v1', undefined, handle)).resolves.toBe(
        'ok'
      );

      expect(mockTransacao.acceptDistributedTraceHeaders).toHaveBeenCalledWith('Kafka', {});
      expect(handle).toHaveBeenCalledTimes(1);
    });

    it('devolve o resultado do handler', async () => {
      await expect(
        comTransacaoDeConsumo('os.eventos.v1', {}, () => Promise.resolve({ eventId: 'e-1' }))
      ).resolves.toEqual({ eventId: 'e-1' });
    });

    it('aguarda o handler: a promise só resolve depois dele', async () => {
      let liberar!: () => void;
      const handler = new Promise<void>((resolve) => {
        liberar = resolve;
      });
      let resolveu = false;

      const pendente = comTransacaoDeConsumo('os.eventos.v1', {}, () => handler).then(() => {
        resolveu = true;
      });
      await new Promise((resolve) => setImmediate(resolve));
      expect(resolveu).toBe(false);

      liberar();
      await pendente;
      expect(resolveu).toBe(true);
    });

    it('propaga o erro do handler, para o retry e a DLT do consumidor funcionarem', async () => {
      const erro = new Error('banco indisponível');

      await expect(
        comTransacaoDeConsumo('execucao.eventos.v1', {}, () => Promise.reject(erro))
      ).rejects.toBe(erro);
    });
  });
});
