import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { OrdemServicoCriada } from '../../domain/events/ordem-servico-criada.event';

/**
 * Confirma RECEIVED na criação da OS. A OS nasce em RECEIVED; se já estiver em outro status, a
 * volta a RECEIVED passa pela máquina de estados (`StatusTransitionService`), que não aceita
 * regressão: o handler não grava e só registra o log (#332).
 */
@Injectable()
export class AtualizarStatusRecebidaHandler {
  private readonly logger = new Logger(AtualizarStatusRecebidaHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('OrdemServicoCriada')
  async handle(evento: OrdemServicoCriada): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status === 'RECEIVED') return;

    try {
      this.transicao.validarTransicao(os.status, 'RECEIVED');
    } catch (erro) {
      if (!(erro instanceof DomainException)) throw erro;
      this.logger.warn(
        `[P-01] OS ${evento.ordemServicoId} em ${os.status}: não volta a RECEIVED (${erro.message})`
      );
      return;
    }
    await this.ordemServicoRepository.update(evento.ordemServicoId, {
      status: 'RECEIVED',
      motivo: 'Status reconfirmado como RECEIVED',
    });
  }
}
