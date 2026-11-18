import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, type Consumer, type ConsumerCrashEvent, type Producer } from 'kafkajs';
import type { IPublicadorIntegracao } from '../../../../shared/domain/interfaces/publicador-integracao.interface';
import {
  BILLING_TOPIC,
  EXECUCAO_TOPIC,
  OS_CONSUMER_GROUP,
  OS_DLT_TOPIC,
  OS_PRODUCER_OPTIONS,
  OS_RETRY_TOPIC,
  RECONEXAO_CONSUMER_MS,
  kafkaHabilitado,
  osKafkaConfig,
  osKafkaSendRequest,
} from '../../../../shared/infrastructure/mensageria/kafka.config';
import {
  comTransacaoDeConsumo,
  injetarHeadersTrace,
} from '../../../../shared/infrastructure/observability/kafka-trace';
import { ProcessadorMensagensSaga, type Despachante } from './processador-mensagens-saga';

// fromBeginning: false também no retry e na DLT: um consumer group novo não reprocessa
// falhas antigas (nem reemite EtapaDaSagaFalhou de mensagens já tratadas).
export const TOPICOS_CONSUMIDOS = [EXECUCAO_TOPIC, BILLING_TOPIC, OS_RETRY_TOPIC, OS_DLT_TOPIC];

type ConsumerSaga = Pick<
  Consumer,
  'connect' | 'disconnect' | 'subscribe' | 'run' | 'seek' | 'on' | 'events'
>;
type ProducerSaga = Pick<Producer, 'connect' | 'disconnect' | 'send'>;

/**
 * Consumer group `os-consumer` (ADR-0018). Criado por factory em `OrdemServicoModule`.
 *
 * A subida não espera o broker: o `onModuleInit` dispara a conexão em background e, se ela
 * falhar (broker fora) ou se o kafkajs desistir depois (CRASH sem restart), tenta de novo a
 * cada `RECONEXAO_CONSUMER_MS`. As rotas HTTP do OS Service sobem de qualquer forma.
 */
export class KafkaConsumidorSaga implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumidorSaga.name);
  private readonly consumer: ConsumerSaga | null = null;
  private readonly producer: ProducerSaga | null = null;
  private readonly processador: ProcessadorMensagensSaga;
  private readonly timers = new Set<NodeJS.Timeout>();
  private encerrando = false;

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
        await this.producer?.send(osKafkaSendRequest(topic, key, envelope, injetarHeadersTrace()));
      },
    });
  }

  onModuleInit(): void {
    if (!this.consumer || !this.producer) {
      this.logger.warn('KAFKA_BROKERS não definido: o OS Service não consome eventos da saga');
      return;
    }
    this.consumer.on(this.consumer.events.CRASH, (evento: ConsumerCrashEvent) =>
      this.aoCrash(evento)
    );
    void this.iniciar();
  }

  async onModuleDestroy(): Promise<void> {
    this.encerrando = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (!this.consumer || !this.producer) return;
    await Promise.all([this.consumer.disconnect(), this.producer.disconnect()]);
  }

  /** Conecta, assina e roda. Nunca rejeita: em falha, agenda nova tentativa. */
  async iniciar(): Promise<void> {
    if (this.encerrando || !this.consumer || !this.producer) return;
    const consumer = this.consumer;
    try {
      await Promise.all([consumer.connect(), this.producer.connect()]);
      await consumer.subscribe({ topics: TOPICOS_CONSUMIDOS, fromBeginning: false });
      await consumer.run({
        eachMessage: async (payload) => {
          const { topic, partition, message } = payload;
          // A transação cobre o processamento inteiro, inclusive o retry e a DLT que saem dele.
          const adiamento = await comTransacaoDeConsumo(topic, message.headers, () =>
            this.processador.processar(topic, message.key?.toString() ?? null, message.value)
          );
          if (adiamento) {
            this.adiar(topic, partition, message.offset, adiamento.esperaMs, () => payload.pause());
          }
        },
      });
      this.logger.log(`Consumindo ${TOPICOS_CONSUMIDOS.join(', ')}`);
    } catch (erro) {
      this.logger.error(
        `Consumer da saga não conectou (${erro instanceof Error ? erro.message : String(erro)}): nova tentativa em ${RECONEXAO_CONSUMER_MS} ms`
      );
      this.agendar(() => void this.iniciar(), RECONEXAO_CONSUMER_MS);
    }
  }

  // Backoff do retry topic (ADR-0018) sem esperar dentro do eachMessage: pausa só esta
  // partição e volta o offset para a própria mensagem, que é entregue de novo no resume.
  // O seek é aplicado (e commitado) no próximo fetch, então o offset seguinte que o kafkajs
  // resolve ao sair do eachMessage não vale. execucao.eventos.v1 segue consumindo.
  private adiar(
    topic: string,
    partition: number,
    offset: string,
    esperaMs: number,
    pause: () => () => void
  ): void {
    const retomar = pause();
    this.consumer?.seek({ topic, partition, offset });
    this.agendar(retomar, esperaMs);
  }

  private aoCrash({ payload }: ConsumerCrashEvent): void {
    const { error, restart } = payload;
    if (restart) {
      this.logger.warn(`Consumer da saga caiu e o kafkajs vai reiniciar: ${error.message}`);
      return;
    }
    this.logger.error(`Consumer da saga parou e o kafkajs não reinicia: ${error.message}`);
    this.agendar(() => void this.reconectar(), RECONEXAO_CONSUMER_MS);
  }

  private async reconectar(): Promise<void> {
    try {
      await this.consumer?.disconnect();
    } catch (erro) {
      this.logger.warn(
        `Falha ao desconectar o consumer antes de reconectar: ${erro instanceof Error ? erro.message : String(erro)}`
      );
    }
    await this.iniciar();
  }

  private agendar(acao: () => void, ms: number): void {
    if (this.encerrando) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      acao();
    }, ms);
    timer.unref();
    this.timers.add(timer);
  }
}
