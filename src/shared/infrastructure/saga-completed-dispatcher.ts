import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SagaCompleted } from '../domain/events/saga-compensation.events';
import type { IEmissorEventos } from '../domain/interfaces/emissor-eventos.interface';
import { SagaCompensationStore } from './database/saga-compensation.store';
import { EMISSOR_EVENTOS } from '../domain/interfaces/emissor-eventos.interface';

@Injectable()
export class SagaCompletedDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly intervalMs = Number(process.env.SAGA_OUTBOX_POLL_INTERVAL_MS ?? 1000);

  constructor(
    private readonly store: SagaCompensationStore,
    @Inject(EMISSOR_EVENTOS) private readonly emissor: IEmissorEventos
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    void this.poll();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let item;
      while ((item = await this.store.claimSagaForPublication())) {
        try {
          await this.emissor.emitir(new SagaCompleted(item.ordemServicoId, item.compensacoes, item.eventId));
           await this.store.markSagaPublished(item.eventId, item.fencingToken);
        } catch (error) {
          await this.store.markSagaPublicationFailed(
             item.eventId,
             error instanceof Error ? error.message : String(error),
             item.fencingToken
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
