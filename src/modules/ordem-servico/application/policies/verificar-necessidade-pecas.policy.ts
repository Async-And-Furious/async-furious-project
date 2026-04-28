import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BarramentoEventos } from '../../../../shared/infrastructure/barramento-eventos/barramento-eventos.service';
import { OrcamentoAprovado } from '../../domain/events/orcamento-aprovado.event';
import { OsSemPecasConfirmada } from '../../domain/events/os-sem-pecas-confirmada.event';
import { OrcamentoAprovadoComPecas } from '../../domain/events/orcamento-aprovado-com-pecas.event';

@Injectable()
export class VerificarNecessidadePecasPolicy {
  constructor(private readonly barramento: BarramentoEventos) {}

  @OnEvent('OrcamentoAprovado')
  async handle(evento: OrcamentoAprovado): Promise<void> {
    if (evento.valorTotalPecas > 0) {
      // Emit event for pecas-insumos module to reserve stock (P-18 listener)
      await this.barramento.emitir(
        new OrcamentoAprovadoComPecas(evento.ordemServicoId, evento.orcamentoId),
      );
    } else {
      await this.barramento.emitir(new OsSemPecasConfirmada(evento.ordemServicoId));
    }
  }
}
