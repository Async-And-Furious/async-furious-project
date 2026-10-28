import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { OrdemServicoEmExecucao } from '../../domain/events/ordem-servico-em-execucao.event';

/**
 * A reserva de peças não leva mais a OS a IN_PROGRESS: quem faz isso é ExecucaoIniciada
 * (AtualizarStatusExecucaoIniciadaHandler). Aqui PecasReservadas apenas baixa a pendência de
 * reserva e, se a OS já estava aguardando peças, retoma AWAITING_PARTS → IN_PROGRESS.
 *
 * PecasReservadas vem de dois lugares:
 * 1. DebitarEstoqueHandler (peças disponíveis na aprovação) → OS em AWAITING_APPROVAL
 * 2. LiberarOrdensAguardandoPecasHandler (peças recebidas do fornecedor) → OS em
 *    AWAITING_APPROVAL (reserva pendente), AWAITING_PARTS ou IN_PROGRESS (reserva tardia,
 *    confirmada depois de o reparo já ter começado: só baixa a pendência, se houver)
 */
const STATUS_COM_RESERVA: OSStatus[] = ['AWAITING_APPROVAL', 'AWAITING_PARTS', 'IN_PROGRESS'];

@Injectable()
export class AtualizarStatusEmExecucaoHandler {
  private readonly logger = new Logger(AtualizarStatusEmExecucaoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('PecasReservadas')
  async handlePecasReservadas(evento: { ordemServicoId: string }): Promise<void> {
    const ordemServicoId = evento.ordemServicoId;
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (!STATUS_COM_RESERVA.includes(os.status)) {
      this.logger.warn(
        `[P-08] OS ${ordemServicoId} em status inválido para registrar reserva de peças: ${os.status}`
      );
      return;
    }

    // Ordem fixa: baixar a pendência antes da retomada. ExecucaoIniciada só grava AWAITING_PARTS
    // com a pendência ligada no momento da gravação. Se ele gravou antes deste passo, a retomada
    // abaixo a enxerga; se gravar depois, a condição não casa e a OS segue em IN_PROGRESS.
    await this.ordemServicoRepository.atualizarSeCondicao(
      ordemServicoId,
      { reserva_pecas_pendente: true },
      { reserva_pecas_pendente: false }
    );

    this.transicao.validarTransicao('AWAITING_PARTS', 'IN_PROGRESS');
    const retomou = await this.ordemServicoRepository.atualizarSeCondicao(
      ordemServicoId,
      { status: 'AWAITING_PARTS' },
      { status: 'IN_PROGRESS' }
    );
    if (retomou) {
      await this.emissor.emitir(new OrdemServicoEmExecucao(ordemServicoId));
      return;
    }

    if (os.status === 'IN_PROGRESS') {
      this.logger.log(
        `[P-08] PecasReservadas tardia: OS ${ordemServicoId} já está em IN_PROGRESS, pendência baixada`
      );
    }
  }
}
