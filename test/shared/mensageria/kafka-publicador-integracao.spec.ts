import { Logger } from '@nestjs/common';
import { Partitioners, type PartitionMetadata, type ProducerRecord } from 'kafkajs';
import { KafkaPublicadorIntegracao } from '../../../src/shared/infrastructure/mensageria/kafka-publicador-integracao';
import { montarEnvelope } from '../../../src/shared/infrastructure/mensageria/envelope';
import {
  OS_PRODUCER_OPTIONS,
  OS_TOPIC,
  kafkaHabilitado,
  osKafkaConfig,
  osKafkaSendRequest,
} from '../../../src/shared/infrastructure/mensageria/kafka.config';
import { OrdemServicoRecebida } from '../../../src/modules/ordem-servico/domain/events/ordem-servico-recebida.event';
import { OrcamentoCalculado } from '../../../src/modules/ordem-servico/domain/events/orcamento-calculado.event';
import { EtapaDaSagaFalhou } from '../../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';

const OS_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const ENV = { KAFKA_BROKERS: 'kafka:9092' } as NodeJS.ProcessEnv;

function kafkaFake() {
  const producer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn<Promise<unknown[]>, [ProducerRecord]>().mockResolvedValue([]),
  };
  return { producer, kafka: { producer: jest.fn().mockReturnValue(producer) } };
}

describe('Configuração do Kafka do OS Service', () => {
  it('usa SASL/PLAIN só com as duas credenciais e falha com uma só', () => {
    expect(
      osKafkaConfig({
        KAFKA_BROKERS: 'kafka-0:9092, kafka-1:9092',
        KAFKA_CLIENT_ID: 'os-service',
        KAFKA_SASL_USERNAME: 'app',
        KAFKA_SASL_PASSWORD: 'segredo',
      })
    ).toEqual({
      clientId: 'os-service',
      brokers: ['kafka-0:9092', 'kafka-1:9092'],
      sasl: { mechanism: 'plain', username: 'app', password: 'segredo' },
    });
    expect(osKafkaConfig(ENV)).toEqual({ clientId: 'os-service', brokers: ['kafka:9092'] });
    expect(() => osKafkaConfig({ ...ENV, KAFKA_SASL_USERNAME: 'app' })).toThrow(
      'devem ser configurados juntos'
    );
  });

  it('publica com acks=-1 e produtor idempotente, sem criar tópico', () => {
    expect(OS_PRODUCER_OPTIONS).toMatchObject({ idempotent: true, allowAutoTopicCreation: false });
    // Retry finito: sem ele o kafkajs idempotente tenta para sempre e o `send` nunca rejeita.
    expect(OS_PRODUCER_OPTIONS.retry?.retries).toBe(5);
    expect(osKafkaSendRequest(OS_TOPIC, OS_ID, { a: 1 })).toEqual({
      topic: 'os.eventos.v1',
      acks: -1,
      messages: [{ key: OS_ID, value: '{"a":1}' }],
    });
  });

  it('só liga o Kafka com KAFKA_BROKERS definido', () => {
    expect(kafkaHabilitado(ENV)).toBe(true);
    expect(kafkaHabilitado({})).toBe(false);
    expect(kafkaHabilitado({ KAFKA_BROKERS: '  ' })).toBe(false);
  });
});

describe('Envelope de integração (ADR-0018)', () => {
  it('monta o envelope de OrcamentoCalculado com correlationId = ordemServicoId', () => {
    const evento = new OrcamentoCalculado(OS_ID, 450, 320.5, 770.5);

    expect(montarEnvelope(evento)).toEqual({
      eventId: evento.eventId,
      eventType: 'OrcamentoCalculado',
      eventVersion: 1,
      occurredAt: evento.ocorridoEm.toISOString(),
      correlationId: OS_ID,
      producer: 'os-service',
      data: {
        ordemServicoId: OS_ID,
        valorTotalServicos: 450,
        valorTotalPecas: 320.5,
        valorTotalGeral: 770.5,
      },
    });
  });

  it('leva o payload de EtapaDaSagaFalhou sem os campos internos do evento de domínio', () => {
    const evento = new EtapaDaSagaFalhou(
      'os-service',
      'ExecucaoConcluida',
      OS_ID,
      'reparo',
      'OS aguardando peças'
    );

    expect(montarEnvelope(evento).data).toEqual({
      servicoOrigem: 'os-service',
      eventTypeOriginal: 'ExecucaoConcluida',
      ordemServicoId: OS_ID,
      etapa: 'reparo',
      motivo: 'OS aguardando peças',
    });
  });
});

describe('KafkaPublicadorIntegracao', () => {
  it('publica em os.eventos.v1 com chave e correlationId iguais ao ordemServicoId', async () => {
    const { producer, kafka } = kafkaFake();
    const publicador = new KafkaPublicadorIntegracao(ENV, kafka);
    publicador.onModuleInit();

    await publicador.publicar(new OrdemServicoRecebida(OS_ID));

    expect(kafka.producer).toHaveBeenCalledWith(OS_PRODUCER_OPTIONS);
    expect(producer.connect).toHaveBeenCalledTimes(1);
    const registro = producer.send.mock.calls[0][0];
    const envelope = JSON.parse(String(registro.messages[0].value)) as {
      correlationId: string;
      eventType: string;
      data: { ordemServicoId: string };
    };
    expect(registro).toMatchObject({ topic: OS_TOPIC, acks: -1 });
    expect(registro.messages[0].key).toBe(OS_ID);
    expect(envelope.correlationId).toBe(OS_ID);
    expect(envelope.data.ordemServicoId).toBe(OS_ID);
    expect(envelope.eventType).toBe('OrdemServicoRecebida');
  });

  it('mantém a ordem dos eventos da mesma OS: mesma chave, mesma partição, envio na ordem emitida', async () => {
    const { producer, kafka } = kafkaFake();
    const publicador = new KafkaPublicadorIntegracao(ENV, kafka);
    publicador.onModuleInit();

    await publicador.publicar(new OrdemServicoRecebida(OS_ID));
    await publicador.publicar(new OrcamentoCalculado(OS_ID, 100, 50, 150));
    await publicador.publicar(new OrcamentoCalculado('outra-os', 1, 1, 2));

    const enviados = producer.send.mock.calls.map(([registro]) => ({
      key: registro.messages[0].key as string,
      eventType: (JSON.parse(String(registro.messages[0].value)) as { eventType: string })
        .eventType,
    }));
    expect(enviados.slice(0, 2)).toEqual([
      { key: OS_ID, eventType: 'OrdemServicoRecebida' },
      { key: OS_ID, eventType: 'OrcamentoCalculado' },
    ]);

    // O particionador configurado no producer: a mesma chave sempre vai para a mesma partição.
    const particionar = Partitioners.DefaultPartitioner();
    const partitionMetadata: PartitionMetadata[] = Array.from({ length: 3 }, (_, partitionId) => ({
      partitionId,
      leader: 0,
      partitionErrorCode: 0,
      replicas: [0],
      isr: [0],
    }));
    const particoes = enviados.map(({ key }) =>
      particionar({ topic: OS_TOPIC, partitionMetadata, message: { key, value: null } })
    );
    expect(particoes[0]).toBe(particoes[1]);
  });

  it('desligado (sem KAFKA_BROKERS) não cria producer, não conecta e não publica', async () => {
    const { producer, kafka } = kafkaFake();
    const publicador = new KafkaPublicadorIntegracao({}, kafka);

    publicador.onModuleInit();
    await publicador.publicar(new OrdemServicoRecebida(OS_ID));
    await publicador.onModuleDestroy();

    expect(kafka.producer).not.toHaveBeenCalled();
    expect(producer.connect).not.toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('broker fora na subida: onModuleInit não lança, loga, e a próxima publicação reconecta', async () => {
    const { producer, kafka } = kafkaFake();
    producer.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const publicador = new KafkaPublicadorIntegracao(ENV, kafka);

    expect(() => publicador.onModuleInit()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(erro).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));

    await publicador.publicar(new OrdemServicoRecebida(OS_ID));

    expect(producer.connect).toHaveBeenCalledTimes(2);
    expect(producer.send).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });

  it('broker ainda fora na publicação: rejeita sem enviar (a ponte loga, o detector não fecha a OS)', async () => {
    const { producer, kafka } = kafkaFake();
    producer.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    const publicador = new KafkaPublicadorIntegracao(ENV, kafka);

    await expect(publicador.publicar(new OrdemServicoRecebida(OS_ID))).rejects.toThrow(
      'ECONNREFUSED'
    );
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('desconecta no shutdown só se conectou', async () => {
    const { producer, kafka } = kafkaFake();
    const publicador = new KafkaPublicadorIntegracao(ENV, kafka);

    await publicador.onModuleDestroy();
    expect(producer.disconnect).not.toHaveBeenCalled();

    publicador.onModuleInit();
    await publicador.onModuleDestroy();
    expect(producer.disconnect).toHaveBeenCalledTimes(1);
  });
});
