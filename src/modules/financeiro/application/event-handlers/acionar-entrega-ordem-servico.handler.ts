import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import { PagamentoRegistrado } from '../../../ordem-servico/domain/events/pagamento-registrado.event';
import { EMISSOR_EVENTOS } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';

@Injectable()
export class AcionarEntregaOrdemServicoHandler {
  private readonly logger = new Logger(AcionarEntregaOrdemServicoHandler.name);

  constructor(@Inject(EMISSOR_EVENTOS) private readonly emissor: IEmissorEventos) {}

  @OnEvent(PagamentoRegistradoEvent.name)
  async handle(evento: PagamentoRegistradoEvent): Promise<void> {
    this.logger.log(
      `[P-27] Pagamento interno da OS ${evento.ordemServicoId} detectado. Preparando integração.`
    );

    const eventoIntegracao = new PagamentoRegistrado(evento.ordemServicoId, evento.pagamentoId);

    await this.emissor.emitir(eventoIntegracao);

    this.logger.log("[P-27] Evento de Integração 'PagamentoRegistrado' despachado com sucesso!");
  }
}
