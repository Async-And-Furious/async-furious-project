import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrdemServicoAssumida } from '../../domain/events/ordem-servico-assumida.event';
import { StatusAtualizadoEmDiagnostico } from '../../domain/events/status-atualizado-em-diagnostico.event';

@Injectable()
export class AtualizarStatusEmDiagnosticoPolicy {
  private readonly logger = new Logger(AtualizarStatusEmDiagnosticoPolicy.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('OrdemServicoAssumida')
  async handle(evento: OrdemServicoAssumida): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'RECEIVED') {
      this.logger.warn(
        `[P-02] OS ${evento.ordemServicoId} em status inválido para iniciar diagnóstico: ${os.status}`
      );
      return;
    }
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'UNDER_DIAGNOSIS',
    });
    await this.emissor.emitir(new StatusAtualizadoEmDiagnostico(evento.ordemServicoId));
  }
}
