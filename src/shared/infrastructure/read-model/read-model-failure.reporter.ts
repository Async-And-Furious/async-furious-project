import { Logger } from '@nestjs/common';

export const READ_MODEL_FAILURE_EVENT = 'ReadModelProjectionFailure';

type CustomEventRecorder = (eventType: string, attributes: Record<string, string>) => void;

function loadRecorder(): CustomEventRecorder | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const agent = require('newrelic') as { recordCustomEvent?: CustomEventRecorder };
    return agent.recordCustomEvent?.bind(agent) ?? null;
  } catch {
    return null;
  }
}

// Falha de gravação no read model não derruba o request (o Postgres já
// commitou): registra erro e evento custom no New Relic; a próxima escrita
// naquele id ou o rebuild corrigem o documento.
export class ReadModelFailureReporter {
  private readonly logger = new Logger(ReadModelFailureReporter.name);

  // O agente (já carregado pelo main.ts) é resolvido na primeira falha;
  // null desliga o evento custom.
  constructor(private recordCustomEvent?: CustomEventRecorder | null) {}

  report(collection: string, documentId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Falha ao projetar ${collection}/${documentId} no read model: ${message}`,
      error instanceof Error ? error.stack : undefined
    );
    try {
      if (this.recordCustomEvent === undefined) this.recordCustomEvent = loadRecorder();
      this.recordCustomEvent?.(READ_MODEL_FAILURE_EVENT, { collection, documentId, message });
    } catch {
      // o relato não pode virar uma segunda falha
    }
  }
}
