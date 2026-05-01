import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';
import { OrcamentoEnviado } from '../../domain/events/orcamento-enviado.event';

@Injectable()
export class EnviarOrcamentoPolicy {
  private readonly logger = new Logger(EnviarOrcamentoPolicy.name);

  constructor(private readonly emissor: EmissorEventos) {}

  @OnEvent('OrcamentoGerado')
  async handle(evento: OrcamentoGerado): Promise<void> {
    this.logger.log(
      `Orçamento ${evento.orcamentoId} enviado ao cliente da OS ${evento.ordemServicoId} (stub).`
    );
    await this.emissor.emitir(new OrcamentoEnviado(evento.ordemServicoId, evento.orcamentoId));
  }
}
