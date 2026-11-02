import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';
import type {
  EventoIntegracao,
  IPublicadorIntegracao,
} from '../../domain/interfaces/publicador-integracao.interface';
import { montarEnvelope } from './envelope';
import {
  OS_PRODUCER_OPTIONS,
  OS_TOPIC,
  kafkaHabilitado,
  osKafkaConfig,
  osKafkaSendRequest,
} from './kafka.config';

/** Criado por factory em `MensageriaModule`: o ambiente entra pelo construtor para o teste. */
export class KafkaPublicadorIntegracao
  implements IPublicadorIntegracao, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaPublicadorIntegracao.name);
  private readonly producer: Producer | null;
  private conectado = false;

  constructor(env: NodeJS.ProcessEnv = process.env, kafka?: Pick<Kafka, 'producer'>) {
    if (!kafkaHabilitado(env)) {
      this.producer = null;
      return;
    }
    this.producer = (kafka ?? new Kafka(osKafkaConfig(env))).producer(OS_PRODUCER_OPTIONS);
  }

  async onModuleInit(): Promise<void> {
    if (!this.producer) {
      this.logger.warn('KAFKA_BROKERS não definido: eventos de integração não serão publicados');
      return;
    }
    await this.producer.connect();
    this.conectado = true;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.conectado && this.producer) await this.producer.disconnect();
  }

  async publicar(evento: EventoIntegracao): Promise<void> {
    const envelope = montarEnvelope(evento);
    if (!this.producer) {
      this.logger.debug(
        `${envelope.eventType} da OS ${evento.ordemServicoId} não publicado: Kafka desligado`
      );
      return;
    }
    await this.producer.send(osKafkaSendRequest(OS_TOPIC, evento.ordemServicoId, envelope));
    this.logger.log(
      `${envelope.eventType} publicado em ${OS_TOPIC}: OS ${evento.ordemServicoId}, eventId ${envelope.eventId}`
    );
  }
}
