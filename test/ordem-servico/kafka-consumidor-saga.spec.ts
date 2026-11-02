import { Logger } from '@nestjs/common';
import type { EachMessagePayload, Kafka } from 'kafkajs';
import {
  KafkaConsumidorSaga,
  TOPICOS_CONSUMIDOS,
} from '../../src/modules/ordem-servico/infrastructure/messaging/kafka-consumidor-saga';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import { FalhaRetentavelException } from '../../src/shared/domain/exceptions/falha-retentavel.exception';
import {
  OS_PRODUCER_OPTIONS,
  OS_RETRY_TOPIC,
} from '../../src/shared/infrastructure/mensageria/kafka.config';

const OS_ID = 'os-1';

function kafkaFake() {
  let eachMessage: ((payload: EachMessagePayload) => Promise<void>) | undefined;
  const consumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
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
      message: { key: Buffer.from(OS_ID), value: Buffer.from(value) },
    } as unknown as EachMessagePayload);
  return {
    consumer,
    producer,
    kafka: kafka as unknown as Pick<Kafka, 'consumer' | 'producer'>,
    kafkaMock: kafka,
    entregar,
  };
}

const ENV = { KAFKA_BROKERS: 'kafka:9092' } as NodeJS.ProcessEnv;
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

    await consumidor.onModuleInit();

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
    await consumidor.onModuleInit();

    await f.entregar(
      'execucao.eventos.v1',
      JSON.stringify({
        eventId: 'e',
        eventType: 'ExecucaoIniciada',
        eventVersion: 1,
        occurredAt: '2026-11-02T12:00:00.000Z',
        correlationId: OS_ID,
        producer: 'execucao-producao-service',
        data: { ordemServicoId: OS_ID },
      })
    );

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

    await consumidor.onModuleInit();
    await consumidor.onModuleDestroy();

    expect(f.kafkaMock.consumer).not.toHaveBeenCalled();
    expect(f.consumer.connect).not.toHaveBeenCalled();
    expect(f.consumer.disconnect).not.toHaveBeenCalled();
  });

  it('desconecta consumer e producer no shutdown', async () => {
    const f = kafkaFake();
    const consumidor = new KafkaConsumidorSaga({}, publicador, ENV, f.kafka);
    await consumidor.onModuleInit();

    await consumidor.onModuleDestroy();

    expect(f.consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(f.producer.disconnect).toHaveBeenCalledTimes(1);
  });
});
