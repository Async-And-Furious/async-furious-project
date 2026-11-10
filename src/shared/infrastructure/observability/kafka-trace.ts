import newrelic from 'newrelic';
import type { IHeaders } from 'kafkajs';

/**
 * Subconjunto da API pública do agente `newrelic` 14 usado aqui (o pacote não traz tipos).
 * Sem transação ativa, `getTransaction` devolve um stub cujos métodos não fazem nada.
 */
interface AgenteTrace {
  getTransaction(): {
    insertDistributedTraceHeaders(headers: Record<string, string>): void;
    acceptDistributedTraceHeaders(transporte: string, headers: Record<string, string>): void;
  };
  startBackgroundTransaction<T>(nome: string, grupo: string, handle: () => Promise<T>): Promise<T>;
}

const agente: AgenteTrace = newrelic;
const GRUPO_APM = 'Kafka';
const TRANSPORTE_KAFKA = 'Kafka';

/**
 * Headers de trace (`traceparent`, `tracestate` e `newrelic`) da transação ativa, para gravar
 * na mensagem publicada. Fora de transação, devolve objeto vazio.
 */
export function injetarHeadersTrace(): Record<string, string> {
  const headers: Record<string, string> = {};
  agente.getTransaction().insertDistributedTraceHeaders(headers);
  return headers;
}

/**
 * Roda o consumo de uma mensagem numa background transaction (APM: `Kafka/<tópico>`) ligada ao
 * trace do publicador. `fn` é aguardada e seus erros propagam, para o retry e a DLT do consumidor
 * continuarem funcionando. A transação termina quando a promise de `fn` resolve ou rejeita.
 */
export function comTransacaoDeConsumo<T>(
  topico: string,
  headers: IHeaders | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const headersTexto = paraTexto(headers);
  return agente.startBackgroundTransaction(topico, GRUPO_APM, () => {
    agente.getTransaction().acceptDistributedTraceHeaders(TRANSPORTE_KAFKA, headersTexto);
    return fn();
  });
}

// O agente lê chaves minúsculas e valores em string. Header com mais de um valor usa o primeiro.
function paraTexto(headers: IHeaders | undefined): Record<string, string> {
  const texto: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(headers ?? {})) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) texto[chave.toLowerCase()] = primeiro.toString();
  }
  return texto;
}
