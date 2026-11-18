import { Partitioners, type KafkaConfig, type ProducerConfig, type ProducerRecord } from 'kafkajs';

export const OS_TOPIC = 'os.eventos.v1';
export const OS_PRODUCER = 'os-service';

// acks=all e produtor idempotente (ADR-0018, "Garantias de publicação"). Sem outbox:
// a publicação sai depois do commit da transação local. O particionador por hash da chave
// (murmur2, compatível com o cliente Java) põe todos os eventos da mesma OS na mesma partição.
//
// Retry finito: com `idempotent` e sem `retry`, o kafkajs usa `retries = MAX_SAFE_INTEGER` e,
// com o broker fora, o `send` nunca rejeita. Com 5 tentativas (backoff padrão de 300 ms a 30 s),
// a falha chega ao chamador em segundos e vai para o log. O kafkajs avisa que limitar o retry do
// produtor idempotente pode invalidar a garantia de exatamente-uma-vez; a ADR-0018 já aceita
// perder o evento (sem outbox), e a deduplicação no consumidor é por `eventId`.
export const OS_PRODUCER_RETRIES = 5;
export const OS_PRODUCER_OPTIONS: ProducerConfig = {
  idempotent: true,
  allowAutoTopicCreation: false,
  createPartitioner: Partitioners.DefaultPartitioner,
  retry: { retries: OS_PRODUCER_RETRIES },
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

/**
 * Chave do registro = `ordemServicoId`: garante a ordem dos eventos da mesma OS no tópico.
 * `headers` leva o trace de Kafka (New Relic) até o consumidor.
 */
export function osKafkaSendRequest(
  topic: string,
  key: string | null,
  envelope: unknown,
  headers?: Record<string, string>
): ProducerRecord {
  return {
    topic,
    acks: -1,
    messages: [{ key, value: JSON.stringify(envelope), headers }],
  };
}

export const EXECUCAO_TOPIC = 'execucao.eventos.v1';
export const BILLING_TOPIC = 'billing.eventos.v1';
export const OS_RETRY_TOPIC = 'os.retry.v1';
export const OS_DLT_TOPIC = 'os.dlt.v1';
export const OS_CONSUMER_GROUP = 'os-consumer';

// 3 entregas no total (ADR-0018): a original e duas pelo retry topic. Backoff de 30 s e 60 s
// (ordem do exemplo da ADR): o "ainda não" existe para a ordem quebrada entre tópicos, e um
// rebalance ou poucos segundos de atraso não podem virar EtapaDaSagaFalhou. A espera não
// acontece dentro do eachMessage: o consumer pausa a partição do retry topic até o notBefore.
export const MAX_TENTATIVAS = 3;

export function backoffMs(tentativa: number): number {
  return 30_000 * 2 ** (tentativa - 1);
}

// Nova tentativa de conexão do consumer quando o broker está fora na subida ou o kafkajs desiste.
export const RECONEXAO_CONSUMER_MS = 15_000;
