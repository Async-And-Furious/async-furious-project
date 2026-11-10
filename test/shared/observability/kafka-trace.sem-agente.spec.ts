// Sem `jest.mock`: o `newrelic` real carrega com o agente desligado (como no ambiente local).
import '../../support/newrelic-desligado';
import {
  comTransacaoDeConsumo,
  injetarHeadersTrace,
} from '../../../src/shared/infrastructure/observability/kafka-trace';

describe('kafka-trace com o agente desligado', () => {
  it('publica sem headers de trace e consome executando o handler', async () => {
    expect(injetarHeadersTrace()).toEqual({});
    await expect(
      comTransacaoDeConsumo('os.eventos.v1', { traceparent: Buffer.from('00-x-y-01') }, () =>
        Promise.resolve('ok')
      )
    ).resolves.toBe('ok');
  });

  it('propaga o erro do handler mesmo sem agente', async () => {
    const erro = new Error('falha de negócio');

    await expect(
      comTransacaoDeConsumo('execucao.eventos.v1', undefined, () => Promise.reject(erro))
    ).rejects.toBe(erro);
  });
});
