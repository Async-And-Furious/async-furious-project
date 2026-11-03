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
 * pendência ligada, e a reentrega faz só o segundo passo. Se a primeira falhar depois de
 * gravar IN_PROGRESS e antes de emitir OrdemServicoEmExecucao, a reentrega (OS em IN_PROGRESS
 * sem iniciada_em) emite de novo, para o monitoramento de tempo começar.
 *
 * Todas as gravações de status são condicionadas no próprio UPDATE (`atualizarSeCondicao`):
 * a leitura de `findOne` não decide nada sozinha. Se a condição não casar, a OS é relida e
 * segue pelo estado atual.
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
    const ordemServicoId = evento.ordemServicoId;
    let os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (ANTES_DA_APROVACAO.includes(os.status)) {
      throw new FalhaRetentavelException(
        `[P-08] ExecucaoIniciada antes da aprovação: OS ${ordemServicoId} em ${os.status}, esperado AWAITING_APPROVAL`
      );
    }

    if (os.status === 'AWAITING_APPROVAL') {
      this.transicao.validarTransicao('AWAITING_APPROVAL', 'IN_PROGRESS');
      const iniciou = await this.ordemServicoRepository.atualizarSeCondicao(
        ordemServicoId,
        { status: 'AWAITING_APPROVAL' },
        { status: 'IN_PROGRESS' }
      );
      if (iniciou) {
        await this.emissor.emitir(new OrdemServicoEmExecucao(ordemServicoId));
        await this.aguardarPecasSePendente(ordemServicoId);
        return;
      }
      // Outra entrega ou evento mudou a OS depois da leitura: segue pelo estado atual.
      os = await this.ordemServicoRepository.findOne(ordemServicoId);
    }

    // Retomada: a OS já está em IN_PROGRESS (primeira gravação feita numa entrega anterior
    // que falhou, ou entrega concorrente). Sem iniciada_em, o início do monitoramento não
    // chegou a acontecer: emite de novo.
    if (os.status === 'IN_PROGRESS') {
      if (os.iniciada_em === null) {
        await this.emissor.emitir(new OrdemServicoEmExecucao(ordemServicoId));
      }
      await this.aguardarPecasSePendente(ordemServicoId);
      return;
    }

    this.logger.log(
      `[P-08] ExecucaoIniciada ignorada: OS ${ordemServicoId} em ${os.status}, esperado AWAITING_APPROVAL`
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
