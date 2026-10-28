import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import type { OSStatus } from '../../domain/entities/ordem-servico.entity';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import { ExecucaoIniciada } from '../../domain/events/execucao-iniciada.event';
import { OrdemServicoEmExecucao } from '../../domain/events/ordem-servico-em-execucao.event';
import { StatusAtualizadoAguardandoPecas } from '../../domain/events/status-atualizado-aguardando-pecas.event';

/**
 * ExecucaoIniciada significa "o mecânico iniciou o reparo". Leva a OS de AWAITING_APPROVAL a
 * IN_PROGRESS e, se a reserva de peças ficou pendente, em seguida a AWAITING_PARTS (não existe
 * AWAITING_APPROVAL → AWAITING_PARTS direto).
 *
 * As duas gravações são retomáveis: se a segunda falhar, a OS fica em IN_PROGRESS com a
 * pendência ligada, e a reentrega faz só o segundo passo.
 *
 * A ida a AWAITING_PARTS é condicionada, no próprio UPDATE, a status IN_PROGRESS e a
 * reserva_pecas_pendente = true. Se PecasReservadas baixar a pendência entre as duas
 * gravações, o UPDATE não casa e a OS segue em IN_PROGRESS (a leitura de `findOne` não
 * decide nada sozinha).
 */
// Estados anteriores à aprovação: o evento chegou antes da hora. Falha retentável (ADR-0018).
const ANTES_DA_APROVACAO: OSStatus[] = ['RECEIVED', 'UNDER_DIAGNOSIS'];

@Injectable()
export class AtualizarStatusExecucaoIniciadaHandler {
  private readonly logger = new Logger(AtualizarStatusExecucaoIniciadaHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly emissor: IEmissorEventos,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('ExecucaoIniciada')
  async handle(evento: ExecucaoIniciada): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(evento.ordemServicoId);

    if (ANTES_DA_APROVACAO.includes(os.status)) {
      throw new FalhaRetentavelException(
        `[P-08] ExecucaoIniciada antes da aprovação: OS ${evento.ordemServicoId} em ${os.status}, esperado AWAITING_APPROVAL`
      );
    }

    if (os.status === 'AWAITING_APPROVAL') {
      this.transicao.validarTransicao('AWAITING_APPROVAL', 'IN_PROGRESS');
      await this.ordemServicoRepository.update(evento.ordemServicoId, { status: 'IN_PROGRESS' });
      await this.emissor.emitir(new OrdemServicoEmExecucao(evento.ordemServicoId));
      await this.aguardarPecasSePendente(evento.ordemServicoId);
      return;
    }

    // Retomada: a primeira gravação foi feita numa entrega anterior que falhou antes da segunda.
    if (os.status === 'IN_PROGRESS') {
      await this.aguardarPecasSePendente(evento.ordemServicoId);
      return;
    }

    this.logger.log(
      `[P-08] ExecucaoIniciada ignorada: OS ${evento.ordemServicoId} em ${os.status}, esperado AWAITING_APPROVAL`
    );
  }

  private async aguardarPecasSePendente(ordemServicoId: string): Promise<void> {
    this.transicao.validarTransicao('IN_PROGRESS', 'AWAITING_PARTS');
    const aplicou = await this.ordemServicoRepository.atualizarSeCondicao(
      ordemServicoId,
      { status: 'IN_PROGRESS', reserva_pecas_pendente: true },
      { status: 'AWAITING_PARTS' }
    );
    if (!aplicou) {
      this.logger.log(
        `[P-08] OS ${ordemServicoId} sem reserva de peças pendente no momento da gravação: segue em IN_PROGRESS`
      );
      return;
    }
    await this.emissor.emitir(new StatusAtualizadoAguardandoPecas(ordemServicoId));
  }
}
