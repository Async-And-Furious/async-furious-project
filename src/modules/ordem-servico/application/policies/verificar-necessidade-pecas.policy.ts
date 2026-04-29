import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { OrcamentoAprovado } from '../../domain/events/orcamento-aprovado.event';
import { OsSemPecasConfirmada } from '../../domain/events/os-sem-pecas-confirmada.event';
import { OrcamentoAprovadoComPecas } from '../../domain/events/orcamento-aprovado-com-pecas.event';

@Injectable()
export class VerificarNecessidadePecasPolicy {
  constructor(private readonly emissor: EmissorEventos) {}

  @OnEvent('OrcamentoAprovado')
  async handle(evento: OrcamentoAprovado): Promise<void> {
    if (evento.valorTotalPecas > 0) {
      // Emit event for pecas-insumos module to reserve stock (P-18 listener)
      await this.emissor.emitir(
        new OrcamentoAprovadoComPecas(evento.ordemServicoId, evento.orcamentoId)
      );
    } else {
      await this.emissor.emitir(new OsSemPecasConfirmada(evento.ordemServicoId));
    }
  }
}
