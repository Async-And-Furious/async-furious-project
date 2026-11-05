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
  private conexao: Promise<void> | null = null;

  constructor(env: NodeJS.ProcessEnv = process.env, kafka?: Pick<Kafka, 'producer'>) {
    if (!kafkaHabilitado(env)) {
      this.producer = null;
      return;
    }
    this.producer = (kafka ?? new Kafka(osKafkaConfig(env))).producer(OS_PRODUCER_OPTIONS);
  }

  // Conecta em segundo plano: com o broker fora na subida, a API sobe assim mesmo (ADR-0018
  // trata o broker como dependência tolerável). A próxima publicação tenta conectar de novo.
  onModuleInit(): void {
    if (!this.producer) {
      this.logger.warn('KAFKA_BROKERS não definido: eventos de integração não serão publicados');
      return;
    }
    this.conectar().catch((error: unknown) =>
      this.logger.error(
        `Kafka indisponível na subida, nova tentativa na próxima publicação: ${mensagemDe(error)}`
      )
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.conexao) await this.conexao.catch(() => undefined);
    if (this.conectado && this.producer) await this.producer.disconnect();
  }

  // Reaproveita a conexão em andamento; se ela falhou, a chamada seguinte abre outra. O kafkajs
  // não conecta sozinho no `send` de um producer que nunca conectou ("The producer is disconnected").
  private conectar(): Promise<void> {
    if (!this.producer) return Promise.resolve();
    this.conexao ??= this.producer.connect().then(
      () => {
        this.conectado = true;
      },
      (error: unknown) => {
        this.conexao = null;
        throw error;
      }
    );
    return this.conexao;
  }

  async publicar(evento: EventoIntegracao): Promise<void> {
    const envelope = montarEnvelope(evento);
    if (!this.producer) {
      this.logger.debug(
        `${envelope.eventType} da OS ${evento.ordemServicoId} não publicado: Kafka desligado`
      );
      return;
    }
    await this.conectar();
    await this.producer.send(osKafkaSendRequest(OS_TOPIC, evento.ordemServicoId, envelope));
    this.logger.log(
      `${envelope.eventType} publicado em ${OS_TOPIC}: OS ${evento.ordemServicoId}, eventId ${envelope.eventId}`
    );
  }
}

function mensagemDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
