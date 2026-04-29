import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { PecasIndisponiveis } from '../../../pecas-insumos/domain/events/pecas-indisponiveis.event';
import { StatusAtualizadoAguardandoPecas } from '../../domain/events/status-atualizado-aguardando-pecas.event';

@Injectable()
export class AtualizarStatusAguardandoPecasPolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('PecasIndisponiveis')
  async handle(evento: PecasIndisponiveis): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'AWAITING_PARTS' });
    await this.emissor.emitir(new StatusAtualizadoAguardandoPecas(evento.ordemServicoId));
  }
}
