import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PagamentoRegistradoEvent } from '../../domain/events/pagamento-registrado.event';
import { AcionarEntregaOrdemServicoPolicy } from '../../application/policies/acionar-entrega-ordem-servico.policy';

@Injectable()
export class AcionarEntregaOrdemServicoListener {
  constructor(private readonly policy: AcionarEntregaOrdemServicoPolicy) {}

  @OnEvent(PagamentoRegistradoEvent.name)
  async handle(evento: PagamentoRegistradoEvent): Promise<void> {
    await this.policy.handle(evento);
  }
}