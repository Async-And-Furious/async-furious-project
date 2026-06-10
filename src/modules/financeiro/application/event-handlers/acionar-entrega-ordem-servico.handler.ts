import { Injectable, Logger } from '@nestjs/common';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import { PagamentoRegistrado } from '../../../ordem-servico/domain/events/pagamento-registrado.event';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';

@Injectable()
export class AcionarEntregaOrdemServicoHandler {
  private readonly logger = new Logger(AcionarEntregaOrdemServicoHandler.name);

  constructor(private readonly emissor: EmissorEventos) {}

  async handle(evento: PagamentoRegistradoEvent): Promise<void> {
    this.logger.log(
      `[P-27] Pagamento interno da OS ${evento.ordemServicoId} detectado. Preparando integração.`
    );

    const eventoIntegracao = new PagamentoRegistrado(evento.ordemServicoId, evento.pagamentoId);

    await this.emissor.emitir(eventoIntegracao);

    this.logger.log("[P-27] Evento de Integração 'PagamentoRegistrado' despachado com sucesso!");
  }
}
