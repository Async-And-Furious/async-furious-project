import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';
import { OrcamentoEnviado } from '../../domain/events/orcamento-enviado.event';

@Injectable()
export class EnviarOrcamentoHandler {
  private readonly logger = new Logger(EnviarOrcamentoHandler.name);

  constructor(private readonly emissor: IEmissorEventos) {}

  @OnEvent('OrcamentoGerado')
  async handle(evento: OrcamentoGerado): Promise<void> {
    this.logger.log(
      `Orçamento ${evento.orcamentoId} enviado ao cliente da OS ${evento.ordemServicoId} (stub).`
    );
    await this.emissor.emitir(new OrcamentoEnviado(evento.ordemServicoId, evento.orcamentoId));
  }
}
