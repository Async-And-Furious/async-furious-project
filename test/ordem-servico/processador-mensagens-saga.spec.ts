import { Logger } from '@nestjs/common';
import { ProcessadorMensagensSaga } from '../../src/modules/ordem-servico/infrastructure/messaging/processador-mensagens-saga';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import { FalhaRetentavelException } from '../../src/shared/domain/exceptions/falha-retentavel.exception';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';
import { EtapaDaSagaFalhou } from '../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';
import {
  EXECUCAO_TOPIC,
  OS_DLT_TOPIC,
  OS_RETRY_TOPIC,
} from '../../src/shared/infrastructure/mensageria/kafka.config';

const OS_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const AGORA = new Date('2026-11-02T12:00:00.000Z');

const envelope = (eventType: string, extra: Record<string, unknown> = {}) => ({
  eventId: 'evt-1',
  eventType,
  eventVersion: 1,
  occurredAt: '2026-11-02T11:59:59.000Z',
  correlationId: OS_ID,
  producer: 'execucao-producao-service',
  data: { ordemServicoId: OS_ID },
  ...extra,
});

const json = (valor: unknown) => JSON.stringify(valor);

describe('ProcessadorMensagensSaga', () => {
  let despachar: jest.Mock<Promise<void>, [string]>;
  let enviar: jest.Mock<Promise<void>, [string, string | null, unknown]>;
  let aguardar: jest.Mock<Promise<void>, [number]>;
  let publicador: jest.Mocked<IPublicadorIntegracao>;
  let processador: ProcessadorMensagensSaga;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    despachar = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    enviar = jest
      .fn<Promise<void>, [string, string | null, unknown]>()
      .mockResolvedValue(undefined);
    aguardar = jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);
    publicador = { publicar: jest.fn().mockResolvedValue(undefined) };
    processador = new ProcessadorMensagensSaga({
      despachantes: { ExecucaoIniciada: despachar },
      publicador,
      enviar,
      aguardar,
      agora: () => AGORA,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('despacha o evento consumido com o ordemServicoId do envelope e faz ack', async () => {
    await processador.processar(EXECUCAO_TOPIC, OS_ID, json(envelope('ExecucaoIniciada')));

    expect(despachar).toHaveBeenCalledWith(OS_ID);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('faz ack de tipo que o OS Service não consome, sem despachar', async () => {
    await processador.processar(EXECUCAO_TOPIC, OS_ID, json(envelope('EtapaDaSagaFalhou')));

    expect(despachar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON inválido', OS_ID, '{nao-e-json'],
    ['chave diferente do ordemServicoId', 'outra-os', json(envelope('ExecucaoIniciada'))],
    [
      'correlationId diferente do ordemServicoId',
      OS_ID,
      json(envelope('ExecucaoIniciada', { correlationId: 'x' })),
    ],
    ['mensagem sem valor', OS_ID, null],
  ])('envelope inválido (%s) vai direto à DLT sem despachar', async (_caso, chave, valor) => {
    await processador.processar(EXECUCAO_TOPIC, chave, valor);

    expect(despachar).not.toHaveBeenCalled();
    expect(enviar).toHaveBeenCalledWith(
      OS_DLT_TOPIC,
      chave,
      expect.objectContaining({ eventType: 'EnvelopeInvalido', lastError: 'Envelope inválido' })
    );
  });

  it('ainda-não (falha retentável) na primeira entrega vai ao retry topic com backoff de 1 s', async () => {
    despachar.mockRejectedValue(new FalhaRetentavelException('OS ainda em RECEIVED'));

    await processador.processar(EXECUCAO_TOPIC, OS_ID, json(envelope('ExecucaoIniciada')));

    expect(enviar).toHaveBeenCalledWith(OS_RETRY_TOPIC, OS_ID, {
      ...envelope('ExecucaoIniciada'),
      retry: {
        attempt: 1,
        firstFailedAt: AGORA.toISOString(),
        notBefore: '2026-11-02T12:00:01.000Z',
      },
      lastError: 'OS ainda em RECEIVED',
    });
  });

  it('no retry topic, espera o notBefore, e a segunda falha volta ao retry com backoff de 2 s', async () => {
    despachar.mockRejectedValue(new Error('banco indisponível'));
    const retry = {
      attempt: 1,
      firstFailedAt: '2026-11-02T11:59:59.000Z',
      notBefore: '2026-11-02T12:00:00.800Z',
    };

    await processador.processar(
      OS_RETRY_TOPIC,
      OS_ID,
      json(envelope('ExecucaoIniciada', { retry }))
    );

    expect(aguardar).toHaveBeenCalledWith(800);
    expect(enviar).toHaveBeenCalledWith(
      OS_RETRY_TOPIC,
      OS_ID,
      expect.objectContaining({
        retry: {
          attempt: 2,
          firstFailedAt: retry.firstFailedAt,
          notBefore: '2026-11-02T12:00:02.000Z',
        },
      })
    );
  });

  it('a espera no retry topic é limitada, para não estourar o sessionTimeout do grupo', async () => {
    const retry = {
      attempt: 1,
      firstFailedAt: AGORA.toISOString(),
      notBefore: '2026-11-02T13:00:00.000Z',
    };

    await processador.processar(
      OS_RETRY_TOPIC,
      OS_ID,
      json(envelope('ExecucaoIniciada', { retry }))
    );

    expect(aguardar).toHaveBeenCalledWith(5_000);
    expect(despachar).toHaveBeenCalledWith(OS_ID);
  });

  it('a terceira falha vai à DLT com attempt=3 e lastError', async () => {
    despachar.mockRejectedValue(new FalhaRetentavelException('ainda não'));
    const retry = {
      attempt: 2,
      firstFailedAt: '2026-11-02T11:59:57.000Z',
      notBefore: AGORA.toISOString(),
    };

    await processador.processar(
      OS_RETRY_TOPIC,
      OS_ID,
      json(envelope('ExecucaoIniciada', { retry }))
    );

    expect(enviar).toHaveBeenCalledWith(
      OS_DLT_TOPIC,
      OS_ID,
      expect.objectContaining({
        retry: {
          attempt: 3,
          firstFailedAt: retry.firstFailedAt,
          notBefore: AGORA.toISOString(),
        },
        lastError: 'ainda não',
      })
    );
  });

  it.each([
    ['DomainException', new DomainException('transição inválida')],
    ['OS inexistente', new EntityNotFoundException('OrdemDeServico', OS_ID)],
  ])('erro de negócio (%s) vai direto à DLT, sem retry', async (_caso, erro) => {
    despachar.mockRejectedValue(erro);

    await processador.processar(EXECUCAO_TOPIC, OS_ID, json(envelope('ExecucaoIniciada')));

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(
      OS_DLT_TOPIC,
      OS_ID,
      expect.objectContaining({ retry: expect.objectContaining({ attempt: 1 }) })
    );
  });

  describe('consumidor da DLT', () => {
    it.each([
      ['ExecucaoConcluida', 'reparo'],
      ['ExecucaoIniciada', 'reparo'],
      ['DiagnosticoIniciado', 'diagnostico'],
      ['OrcamentoGerado', 'orcamento'],
      ['OrcamentoAprovado', 'aprovacao-pagamento'],
      ['PagamentoRecusado', 'aprovacao-pagamento'],
    ])('%s esgotado publica EtapaDaSagaFalhou com etapa=%s', async (eventType, etapa) => {
      await processador.processar(
        OS_DLT_TOPIC,
        OS_ID,
        json(envelope(eventType, { lastError: 'retry esgotado: x' }))
      );

      const falha = publicador.publicar.mock.calls[0][0] as EtapaDaSagaFalhou;
      expect(falha).toBeInstanceOf(EtapaDaSagaFalhou);
      expect(falha).toMatchObject({
        servicoOrigem: 'os-service',
        eventTypeOriginal: eventType,
        ordemServicoId: OS_ID,
        etapa,
        motivo: 'retry esgotado: x',
      });
      expect(enviar).not.toHaveBeenCalled();
    });

    it.each(['PagamentoConfirmado', 'EtapaDaSagaFalhou', 'EnvelopeInvalido'])(
      '%s fica na DLT para replay manual, sem gerar evento',
      async (eventType) => {
        await processador.processar(OS_DLT_TOPIC, OS_ID, json(envelope(eventType)));

        expect(publicador.publicar).not.toHaveBeenCalled();
      }
    );

    it('mensagem ilegível na DLT não gera evento nem derruba o consumidor', async () => {
      await expect(processador.processar(OS_DLT_TOPIC, null, 'lixo')).resolves.toBeUndefined();
      expect(publicador.publicar).not.toHaveBeenCalled();
    });

    it('falha ao publicar a EtapaDaSagaFalhou sobe, para o kafkajs entregar a mensagem de novo', async () => {
      publicador.publicar.mockRejectedValue(new Error('broker indisponível'));

      await expect(
        processador.processar(OS_DLT_TOPIC, OS_ID, json(envelope('ExecucaoConcluida')))
      ).rejects.toThrow('broker indisponível');
    });
  });
});
