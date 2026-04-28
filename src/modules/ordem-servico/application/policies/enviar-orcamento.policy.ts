import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BarramentoEventos } from '../../../../shared/infrastructure/barramento-eventos/barramento-eventos.service';
import { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';
import { OrcamentoEnviado } from '../../domain/events/orcamento-enviado.event';

@Injectable()
export class EnviarOrcamentoPolicy {
  constructor(private readonly barramento: BarramentoEventos) {}

  @OnEvent('OrcamentoGerado')
  async handle(evento: OrcamentoGerado): Promise<void> {
    // Stub: In a full system, would dispatch notification/email to client
    console.log(
      `[EnviarOrcamento] Orçamento ${evento.orcamentoId} enviado ao cliente da OS ${evento.ordemServicoId} (stub).`,
    );
    await this.barramento.emitir(new OrcamentoEnviado(evento.ordemServicoId, evento.orcamentoId));
  }
}
