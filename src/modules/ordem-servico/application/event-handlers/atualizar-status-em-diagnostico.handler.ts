import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { DiagnosticoIniciado } from '../../domain/events/diagnostico-iniciado.event';
import { OrdemServicoEmDiagnostico } from '../../domain/events/ordem-servico-em-diagnostico.event';

@Injectable()
export class AtualizarStatusEmDiagnosticoHandler {
  private readonly logger = new Logger(AtualizarStatusEmDiagnosticoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('DiagnosticoIniciado')
  async handle(evento: DiagnosticoIniciado): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'RECEIVED') {
      this.logger.log(
        `[P-02] DiagnosticoIniciado ignorado: OS ${evento.ordemServicoId} já está em ${os.status}`
      );
      return;
    }
    this.transicao.validarTransicao('RECEIVED', 'UNDER_DIAGNOSIS');
    // Condicionada ao status no UPDATE: de duas entregas concorrentes, só a que gravou emite
    // OrdemServicoEmDiagnostico (e o cliente é notificado uma vez).
    const aplicou = await this.ordemServicoRepository.atualizarSeCondicao(
      evento.ordemServicoId,
      { status: 'RECEIVED' },
      { status: 'UNDER_DIAGNOSIS' }
    );
    if (!aplicou) {
      this.logger.log(
        `[P-02] DiagnosticoIniciado ignorado: OS ${evento.ordemServicoId} saiu de RECEIVED antes da gravação`
      );
      return;
    }
    await this.emissor.emitir(new OrdemServicoEmDiagnostico(evento.ordemServicoId));
  }
}
