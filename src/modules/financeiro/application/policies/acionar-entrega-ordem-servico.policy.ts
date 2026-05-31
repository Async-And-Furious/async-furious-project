import { Inject, Injectable, Logger } from '@nestjs/common';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import { PagamentoRegistrado } from '../../../ordem-servico/domain/events/pagamento-registrado.event';
import { PAGAMENTO_EVENT_PUBLISHER } from '../../domain/interfaces/pagamento.interface';
import type { IPagamentoEventPublisher } from '../../domain/interfaces/pagamento.interface';

@Injectable()
export class AcionarEntregaOrdemServicoPolicy {
  private readonly logger = new Logger(AcionarEntregaOrdemServicoPolicy.name);

  constructor(
    @Inject(PAGAMENTO_EVENT_PUBLISHER)
    private readonly emissor: IPagamentoEventPublisher
  ) {}

  async handle(evento: PagamentoRegistradoEvent): Promise<void> {
    this.logger.log(
      `[P-27] Pagamento interno da OS ${evento.ordemServicoId} detectado. Preparando integração.`
    );

    const eventoIntegracao = new PagamentoRegistrado(evento.ordemServicoId, evento.pagamentoId);

    await this.emissor.emitir(eventoIntegracao);

    this.logger.log("[P-27] Evento de Integração 'PagamentoRegistrado' despachado com sucesso!");
  }
}
