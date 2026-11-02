import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer, type Producer } from 'kafkajs';
import type { IPublicadorIntegracao } from '../../../../shared/domain/interfaces/publicador-integracao.interface';
import {
  EXECUCAO_TOPIC,
  OS_CONSUMER_GROUP,
  OS_DLT_TOPIC,
  OS_PRODUCER_OPTIONS,
  OS_RETRY_TOPIC,
  kafkaHabilitado,
  osKafkaConfig,
  osKafkaSendRequest,
} from '../../../../shared/infrastructure/mensageria/kafka.config';
import { ProcessadorMensagensSaga, type Despachante } from './processador-mensagens-saga';

// fromBeginning: false também no retry e na DLT: um consumer group novo não reprocessa
// falhas antigas (nem reemite EtapaDaSagaFalhou de mensagens já tratadas).
export const TOPICOS_CONSUMIDOS = [EXECUCAO_TOPIC, OS_RETRY_TOPIC, OS_DLT_TOPIC];

/** Consumer group `os-consumer` (ADR-0018). Criado por factory em `OrdemServicoModule`. */
export class KafkaConsumidorSaga implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumidorSaga.name);
  private readonly consumer: Consumer | null = null;
  private readonly producer: Producer | null = null;
  private readonly processador: ProcessadorMensagensSaga;
  private conectado = false;

  constructor(
    despachantes: Record<string, Despachante>,
    publicador: IPublicadorIntegracao,
    env: NodeJS.ProcessEnv = process.env,
    kafka?: Pick<Kafka, 'consumer' | 'producer'>
  ) {
    if (kafkaHabilitado(env)) {
      const cliente = kafka ?? new Kafka(osKafkaConfig(env));
      this.consumer = cliente.consumer({ groupId: env.KAFKA_CONSUMER_GROUP || OS_CONSUMER_GROUP });
      this.producer = cliente.producer(OS_PRODUCER_OPTIONS);
    }
    this.processador = new ProcessadorMensagensSaga({
      despachantes,
      publicador,
      enviar: async (topic, key, envelope) => {
        await this.producer?.send(osKafkaSendRequest(topic, key, envelope));
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.consumer || !this.producer) {
      this.logger.warn('KAFKA_BROKERS não definido: o OS Service não consome eventos da saga');
      return;
    }
    await Promise.all([this.consumer.connect(), this.producer.connect()]);
    this.conectado = true;
    await this.consumer.subscribe({ topics: TOPICOS_CONSUMIDOS, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ topic, message }) =>
        this.processador.processar(topic, message.key?.toString() ?? null, message.value),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.conectado || !this.consumer || !this.producer) return;
    await Promise.all([this.consumer.disconnect(), this.producer.disconnect()]);
  }
}
