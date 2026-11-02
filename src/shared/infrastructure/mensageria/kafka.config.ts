import { Partitioners, type KafkaConfig, type ProducerConfig, type ProducerRecord } from 'kafkajs';

export const OS_TOPIC = 'os.eventos.v1';
export const OS_PRODUCER = 'os-service';

// acks=all e produtor idempotente (ADR-0018, "Garantias de publicação"). Sem outbox:
// a publicação sai depois do commit da transação local. O particionador por hash da chave
// (murmur2, compatível com o cliente Java) põe todos os eventos da mesma OS na mesma partição.
export const OS_PRODUCER_OPTIONS: ProducerConfig = {
  idempotent: true,
  allowAutoTopicCreation: false,
  createPartitioner: Partitioners.DefaultPartitioner,
};

/** Sem `KAFKA_BROKERS` (dev local, e2e) o publicador fica desligado. Em HML o deploy sempre define. */
export function kafkaHabilitado(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.KAFKA_BROKERS?.trim());
}

export function osKafkaConfig(env: NodeJS.ProcessEnv = process.env): KafkaConfig {
  const username = env.KAFKA_SASL_USERNAME;
  const password = env.KAFKA_SASL_PASSWORD;
  if (Boolean(username) !== Boolean(password)) {
    throw new Error('KAFKA_SASL_USERNAME e KAFKA_SASL_PASSWORD devem ser configurados juntos.');
  }
  return {
    clientId: env.KAFKA_CLIENT_ID ?? OS_PRODUCER,
    brokers: (env.KAFKA_BROKERS ?? '')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
    ...(username && password ? { sasl: { mechanism: 'plain', username, password } } : {}),
  };
}

/** Chave do registro = `ordemServicoId`: garante a ordem dos eventos da mesma OS no tópico. */
export function osKafkaSendRequest(
  topic: string,
  key: string | null,
  envelope: unknown
): ProducerRecord {
  return {
    topic,
    acks: -1,
    messages: [{ key, value: JSON.stringify(envelope) }],
  };
}

export const EXECUCAO_TOPIC = 'execucao.eventos.v1';
export const OS_RETRY_TOPIC = 'os.retry.v1';
export const OS_DLT_TOPIC = 'os.dlt.v1';
export const OS_CONSUMER_GROUP = 'os-consumer';

// 3 entregas no total (ADR-0018): a original e duas pelo retry topic. Backoff de 1 s e 2 s,
// curto para a espera dentro do eachMessage ficar bem abaixo do sessionTimeout do grupo (30 s).
export const MAX_TENTATIVAS = 3;
export const ESPERA_MAXIMA_RETRY_MS = 5_000;

export function backoffMs(tentativa: number): number {
  return 1_000 * 2 ** (tentativa - 1);
}
