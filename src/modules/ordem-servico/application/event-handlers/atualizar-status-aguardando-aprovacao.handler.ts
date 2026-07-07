import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrcamentoEnviado } from '../../domain/events/orcamento-enviado.event';

@Injectable()
export class AtualizarStatusAguardandoAprovacaoHandler {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('OrcamentoEnviado')
  async handle(evento: OrcamentoEnviado): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (os.status === 'UNDER_DIAGNOSIS') {
      await this.ordemServicoRepository.update(evento.ordemServicoId, {
        status: 'AWAITING_APPROVAL',
      });
    }
  }
}
