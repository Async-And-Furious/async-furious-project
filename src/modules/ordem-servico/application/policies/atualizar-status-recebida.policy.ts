import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrdemServicoCriada } from '../../domain/events/ordem-servico-criada.event';

@Injectable()
export class AtualizarStatusRecebidaPolicy {
  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('OrdemServicoCriada')
  async handle(evento: OrdemServicoCriada): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    // OS is created with RECEIVED by default; this policy confirms the state
    if (os.status !== 'RECEIVED') {
      await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'RECEIVED' });
    }
  }
}
