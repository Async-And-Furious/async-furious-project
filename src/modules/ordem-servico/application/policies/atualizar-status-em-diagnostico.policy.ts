import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BarramentoEventos } from '../../../../shared/infrastructure/barramento-eventos/barramento-eventos.service';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrdemServicoAssumida } from '../../domain/events/ordem-servico-assumida.event';
import { StatusAtualizadoEmDiagnostico } from '../../domain/events/status-atualizado-em-diagnostico.event';

@Injectable()
export class AtualizarStatusEmDiagnosticoPolicy {
  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly barramento: BarramentoEventos,
  ) {}

  @OnEvent('OrdemServicoAssumida')
  async handle(evento: OrdemServicoAssumida): Promise<void> {
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'UNDER_DIAGNOSIS',
    });
    await this.barramento.emitir(new StatusAtualizadoEmDiagnostico(evento.ordemServicoId));
  }
}
