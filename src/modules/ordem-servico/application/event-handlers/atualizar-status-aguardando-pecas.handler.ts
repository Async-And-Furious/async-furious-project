import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { StatusAtualizadoAguardandoPecas } from '../../domain/events/status-atualizado-aguardando-pecas.event';
import { PecasIndisponiveis } from '../../../pecas-insumos/domain/events/pecas-indisponiveis.event';

/**
 * PecasIndisponiveis, com a OS ainda em AWAITING_APPROVAL, só registra a pendência da reserva.
 * A transição para AWAITING_PARTS acontece em ExecucaoIniciada (AtualizarStatusExecucaoIniciadaHandler).
 *
 * Reserva tardia: se o reparo já começou (ExecucaoIniciada processado antes desta reserva,
 * possível porque os eventos de tópicos diferentes não têm ordem entre si), a OS está em
 * IN_PROGRESS e vai para AWAITING_PARTS, sem esperar a próxima gravação de ExecucaoIniciada.
 */
@Injectable()
export class AtualizarStatusAguardandoPecasHandler {
  private readonly logger = new Logger(AtualizarStatusAguardandoPecasHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('PecasIndisponiveis')
  async handle(evento: PecasIndisponiveis): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (os.status === 'AWAITING_APPROVAL') {
      await this.ordemServicoRepository.update(evento.ordemServicoId, {
        reserva_pecas_pendente: true,
      });
      return;
    }

    if (os.status === 'IN_PROGRESS') {
      this.transicao.validarTransicao('IN_PROGRESS', 'AWAITING_PARTS');
      await this.ordemServicoRepository.update(evento.ordemServicoId, {
        status: 'AWAITING_PARTS',
      });
      await this.emissor.emitir(new StatusAtualizadoAguardandoPecas(evento.ordemServicoId));
      return;
    }

    if (os.status === 'AWAITING_PARTS') {
      this.logger.log(
        `[P-15] PecasIndisponiveis ignorada: OS ${evento.ordemServicoId} já está em AWAITING_PARTS`
      );
      return;
    }

    this.logger.warn(
      `[P-15] OS ${evento.ordemServicoId} em status inválido para registrar reserva pendente: ${os.status}`
    );
  }
}
