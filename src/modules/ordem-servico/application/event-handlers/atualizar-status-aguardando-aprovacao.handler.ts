import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { StatusTransitionService } from '../../domain/services/status-transition.service';
import type { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';

/**
 * Leva a OS de UNDER_DIAGNOSIS a AWAITING_APPROVAL quando o orçamento fica pronto: OrcamentoGerado
 * do Billing (o Orcamento saiu do OS na #330). Pelo broker, chega via despachante; o @OnEvent
 * serve ao e2e, que simula o Billing in-process.
 *
 * Guarda (ADR-0018): RECEIVED é "ainda-não" (o diagnóstico não foi consumido), falha
 * retentável; de AWAITING_APPROVAL em diante é "já-passou", ack. A gravação é condicionada a
 * UNDER_DIAGNOSIS no próprio UPDATE, então duas entregas não gravam duas vezes. A transição é
 * validada pela máquina de estados (`StatusTransitionService`), como nos demais handlers.
 */
@Injectable()
export class AtualizarStatusAguardandoAprovacaoHandler {
  private readonly logger = new Logger(AtualizarStatusAguardandoAprovacaoHandler.name);

  constructor(
    private readonly ordemServicoRepository: IOrdemServicoRepository,
    private readonly transicao: StatusTransitionService
  ) {}

  @OnEvent('OrcamentoGerado')
  async handleOrcamentoGerado(evento: OrcamentoGerado): Promise<void> {
    await this.aguardarAprovacao(evento.ordemServicoId, 'OrcamentoGerado');
  }

  private async aguardarAprovacao(ordemServicoId: string, origem: string): Promise<void> {
    const os = await this.ordemServicoRepository.findOne(ordemServicoId);

    if (os.status === 'RECEIVED') {
      throw new FalhaRetentavelException(
        `[P-06] ${origem} antes do diagnóstico: OS ${ordemServicoId} em RECEIVED, esperado UNDER_DIAGNOSIS`
      );
    }

    if (os.status === 'UNDER_DIAGNOSIS') {
      this.transicao.validarTransicao('UNDER_DIAGNOSIS', 'AWAITING_APPROVAL');
      const gravou = await this.ordemServicoRepository.atualizarSeCondicao(
        ordemServicoId,
        { status: 'UNDER_DIAGNOSIS' },
        { status: 'AWAITING_APPROVAL' }
      );
      if (gravou) return;
    }

    this.logger.log(
      `[P-06] ${origem} ignorado: OS ${ordemServicoId} já saiu de UNDER_DIAGNOSIS (${os.status})`
    );
  }
}
