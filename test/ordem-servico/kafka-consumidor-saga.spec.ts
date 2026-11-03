import { Logger } from '@nestjs/common';
import type { ConsumerCrashEvent, EachMessagePayload, Kafka } from 'kafkajs';
import {
  KafkaConsumidorSaga,
  TOPICOS_CONSUMIDOS,
} from '../../src/modules/ordem-servico/infrastructure/messaging/kafka-consumidor-saga';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import { FalhaRetentavelException } from '../../src/shared/domain/exceptions/falha-retentavel.exception';
import {
  OS_PRODUCER_OPTIONS,
  OS_RETRY_TOPIC,
  RECONEXAO_CONSUMER_MS,
} from '../../src/shared/infrastructure/mensageria/kafka.config';

const OS_ID = 'os-1';

function kafkaFake() {
  let eachMessage: ((payload: EachMessagePayload) => Promise<void>) | undefined;
  let aoCrash: ((evento: ConsumerCrashEvent) => void) | undefined;
  const retomar = jest.fn();
  const pause = jest.fn().mockReturnValue(retomar);
  const consumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    seek: jest.fn(),
    events: { CRASH: 'consumer.crash' },
    on: jest.fn((_evento: string, listener: (evento: ConsumerCrashEvent) => void) => {
      aoCrash = listener;
      return () => undefined;
    }),
    run: jest.fn((config: { eachMessage: (payload: EachMessagePayload) => Promise<void> }) => {
      eachMessage = config.eachMessage;
      return Promise.resolve();
    }),
  };
  const producer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue([]),
  };
  const kafka = {
    consumer: jest.fn().mockReturnValue(consumer),
    producer: jest.fn().mockReturnValue(producer),
  };
  const entregar = (topic: string, value: string) =>
    eachMessage!({
      topic,
      partition: 0,
      message: { key: Buffer.from(OS_ID), value: Buffer.from(value), offset: '7' },
      pause,
    } as unknown as EachMessagePayload);
  const crash = (restart: boolean) =>
    aoCrash!({
      payload: { error: new Error('broker sumiu'), groupId: 'os-consumer', restart },
    } as unknown as ConsumerCrashEvent);
  return {
    consumer,
    producer,
    pause,
    retomar,
    crash,
    kafka: kafka as unknown as Pick<Kafka, 'consumer' | 'producer'>,
    kafkaMock: kafka,
    entregar,
  };
}

const ENV = { KAFKA_BROKERS: 'kafka:9092' } as NodeJS.ProcessEnv;

// onModuleInit dispara a conexão em background; espera ela terminar.
const subir = async (consumidor: KafkaConsumidorSaga) => {
  consumidor.onModuleInit();
  await new Promise((resolve) => setImmediate(resolve));
};

const envelopeExecucaoIniciada = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    eventId: 'e',
    eventType: 'ExecucaoIniciada',
    eventVersion: 1,
    occurredAt: '2026-11-02T12:00:00.000Z',
    correlationId: OS_ID,
    producer: 'execucao-producao-service',
    data: { ordemServicoId: OS_ID },
    ...extra,
  });
const publicador: IPublicadorIntegracao = { publicar: jest.fn() };

describe('KafkaConsumidorSaga', () => {
  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, nivel).mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('entra no grupo os-consumer e assina execucao, retry e DLT do OS sem fromBeginning', async () => {
    const f = kafkaFake();
    const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);

    await subir(consumidor);

    expect(f.kafkaMock.consumer).toHaveBeenCalledWith({ groupId: 'os-consumer' });
    expect(f.kafkaMock.producer).toHaveBeenCalledWith(OS_PRODUCER_OPTIONS);
    expect(f.consumer.subscribe).toHaveBeenCalledWith({
      topics: ['execucao.eventos.v1', 'os.retry.v1', 'os.dlt.v1'],
      fromBeginning: false,
    });
    expect(TOPICOS_CONSUMIDOS).toHaveLength(3);
  });

  it('usa o KAFKA_CONSUMER_GROUP do ambiente quando definido', () => {
    const f = kafkaFake();
    new KafkaConsumidorSaga({}, publicador, { ...ENV, KAFKA_CONSUMER_GROUP: 'g' }, f.kafka);

    expect(f.kafkaMock.consumer).toHaveBeenCalledWith({ groupId: 'g' });
  });

  it('repassa a mensagem ao processador e publica o retry pelo producer, com a chave da OS', async () => {
    const f = kafkaFake();
    const despachar = jest.fn().mockRejectedValue(new FalhaRetentavelException('ainda não'));
    const consumidor = new KafkaConsumidorSaga(
      { ExecucaoIniciada: despachar },
      publicador,
      ENV,
      f.kafka
    );
    await subir(consumidor);

    await f.entregar('execucao.eventos.v1', envelopeExecucaoIniciada());

    expect(despachar).toHaveBeenCalledWith(OS_ID);
    expect(f.producer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: OS_RETRY_TOPIC,
        acks: -1,
        messages: [expect.objectContaining({ key: OS_ID })],
      })
    );
  });

  it('desligado (sem KAFKA_BROKERS): não cria cliente, não conecta nem assina', async () => {
    const f = kafkaFake();
    const consumidor = new KafkaConsumidorSaga({}, publicador, {}, f.kafka);

    await subir(consumidor);
    await consumidor.onModuleDestroy();

    expect(f.kafkaMock.consumer).not.toHaveBeenCalled();
    expect(f.consumer.connect).not.toHaveBeenCalled();
    expect(f.consumer.disconnect).not.toHaveBeenCalled();
  });

  it('desconecta consumer e producer no shutdown', async () => {
    const f = kafkaFake();
    const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);
    await subir(consumidor);

    await consumidor.onModuleDestroy();

    expect(f.consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(f.producer.disconnect).toHaveBeenCalledTimes(1);
  });
  describe('com timers falsos', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate'] }));
    afterEach(() => jest.useRealTimers());

    it('broker fora na subida: onModuleInit não rejeita e o consumer tenta de novo depois', async () => {
      const f = kafkaFake();
      f.consumer.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);

      await subir(consumidor);
      expect(f.consumer.run).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));

      await jest.advanceTimersByTimeAsync(RECONEXAO_CONSUMER_MS);

      expect(f.consumer.connect).toHaveBeenCalledTimes(2);
      expect(f.consumer.run).toHaveBeenCalledTimes(1);
    });

    it('retry antes do notBefore: pausa a partição, volta o offset e retoma depois da espera, sem despachar', async () => {
      jest.setSystemTime(new Date('2026-11-02T12:00:00.000Z'));
      const f = kafkaFake();
      const despachar = jest.fn().mockResolvedValue(undefined);
      const consumidor = new KafkaConsumidorSaga(
        { ExecucaoIniciada: despachar },
        publicador,
        ENV,
        f.kafka
      );
      await subir(consumidor);

      await f.entregar(
        OS_RETRY_TOPIC,
        envelopeExecucaoIniciada({
          retry: {
            attempt: 1,
            firstFailedAt: '2026-11-02T12:00:00.000Z',
            notBefore: '2026-11-02T12:00:30.000Z',
          },
        })
      );

      expect(despachar).not.toHaveBeenCalled();
      expect(f.pause).toHaveBeenCalledTimes(1);
      expect(f.consumer.seek).toHaveBeenCalledWith({
        topic: OS_RETRY_TOPIC,
        partition: 0,
        offset: '7',
      });
      expect(f.retomar).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(30_000);

      expect(f.retomar).toHaveBeenCalledTimes(1);
    });

    it('CRASH sem restart do kafkajs: desconecta e reconecta depois', async () => {
      const f = kafkaFake();
      const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);
      await subir(consumidor);

      f.crash(false);
      await jest.advanceTimersByTimeAsync(RECONEXAO_CONSUMER_MS);

      expect(f.consumer.disconnect).toHaveBeenCalledTimes(1);
      expect(f.consumer.connect).toHaveBeenCalledTimes(2);
      expect(f.consumer.run).toHaveBeenCalledTimes(2);
    });

    it('CRASH com restart: só registra, o kafkajs reinicia sozinho', async () => {
      const f = kafkaFake();
      const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);
      await subir(consumidor);

      f.crash(true);
      await jest.advanceTimersByTimeAsync(RECONEXAO_CONSUMER_MS);

      expect(f.consumer.connect).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('reiniciar'));
    });

    it('shutdown cancela a reconexão agendada', async () => {
      const f = kafkaFake();
      f.consumer.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);
      await subir(consumidor);

      await consumidor.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(RECONEXAO_CONSUMER_MS);

      expect(f.consumer.connect).toHaveBeenCalledTimes(1);
      expect(f.consumer.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
