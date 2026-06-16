import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import { AcionarEntregaOrdemServicoHandler } from '../../application/event-handlers/acionar-entrega-ordem-servico.handler';

@Injectable()
export class AcionarEntregaOrdemServicoListener {
  constructor(private readonly handler: AcionarEntregaOrdemServicoHandler) {}

  @OnEvent(PagamentoRegistradoEvent.name)
  async handle(evento: PagamentoRegistradoEvent): Promise<void> {
    await this.handler.handle(evento);
  }
}
