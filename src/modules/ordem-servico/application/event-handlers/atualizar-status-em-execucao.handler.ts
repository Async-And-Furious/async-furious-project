import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
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
 *    confirmada depois de o reparo já ter começado: nada a fazer)
 */
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
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (os.status === 'AWAITING_APPROVAL') {
      if (os.reservaPecasPendente) {
        await this.ordemServicoRepository.update(evento.ordemServicoId, {
          reserva_pecas_pendente: false,
        });
      }
      return;
    }

    if (os.status === 'AWAITING_PARTS') {
      this.transicao.validarTransicao('AWAITING_PARTS', 'IN_PROGRESS');
      await this.ordemServicoRepository.update(evento.ordemServicoId, {
        status: 'IN_PROGRESS',
        reserva_pecas_pendente: false,
      });
      await this.emissor.emitir(new OrdemServicoEmExecucao(evento.ordemServicoId));
      return;
    }

    if (os.status === 'IN_PROGRESS') {
      this.logger.log(
        `[P-08] PecasReservadas tardia: OS ${evento.ordemServicoId} já está em IN_PROGRESS, nada a alterar`
      );
      return;
    }

    this.logger.warn(
      `[P-08] OS ${evento.ordemServicoId} em status inválido para registrar reserva de peças: ${os.status}`
    );
  }
}
