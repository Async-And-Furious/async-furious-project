import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { ExecucaoIniciada } from '../../domain/events/execucao-iniciada.event';
import { OrdemServicoEmExecucao } from '../../domain/events/ordem-servico-em-execucao.event';
import { StatusAtualizadoAguardandoPecas } from '../../domain/events/status-atualizado-aguardando-pecas.event';

/**
 * ExecucaoIniciada significa "o mecânico iniciou o reparo". Leva a OS de
 * AWAITING_APPROVAL a IN_PROGRESS e, se a reserva de peças ficou pendente,
 * logo em seguida a AWAITING_PARTS (não existe AWAITING_APPROVAL → AWAITING_PARTS direto).
 */
// Estados em que ExecucaoIniciada é reentrega ou chegou tarde: ack com log informativo.
// Em RECEIVED/UNDER_DIAGNOSIS o evento chegou antes da hora (anomalia): ack com warn.
const STATUS_JA_ALEM_DA_APROVACAO: OSStatus[] = [
  'IN_PROGRESS',
  'AWAITING_PARTS',
  'FINISHED',
  'DELIVERED',
  'CLOSED_WITHOUT_EXECUTION',
];

@Injectable()
export class AtualizarStatusExecucaoIniciadaHandler {
  private readonly logger = new Logger(AtualizarStatusExecucaoIniciadaHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('ExecucaoIniciada')
  async handle(evento: ExecucaoIniciada): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);
    if (os.status !== 'AWAITING_APPROVAL') {
      const mensagem = `[P-08] ExecucaoIniciada ignorada: OS ${evento.ordemServicoId} em ${os.status}, esperado AWAITING_APPROVAL`;
      if (STATUS_JA_ALEM_DA_APROVACAO.includes(os.status)) this.logger.log(mensagem);
      else this.logger.warn(mensagem);
      return;
    }

    await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'IN_PROGRESS' });
    await this.emissor.emitir(new OrdemServicoEmExecucao(evento.ordemServicoId));

    if (os.reservaPecasPendente) {
      await this.ordemServicoRepository.update(evento.ordemServicoId, {
        status: 'AWAITING_PARTS',
      });
      await this.emissor.emitir(new StatusAtualizadoAguardandoPecas(evento.ordemServicoId));
    }
  }
}
