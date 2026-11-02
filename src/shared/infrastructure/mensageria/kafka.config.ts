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
export function osKafkaSendRequest(topic: string, key: string, envelope: unknown): ProducerRecord {
  return {
    topic,
    acks: -1,
    messages: [{ key, value: JSON.stringify(envelope) }],
  };
}
