import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FalhaRetentavelException } from '../../../../shared/domain/exceptions/falha-retentavel.exception';
import type { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';
import { OrcamentoEnviado } from '../../domain/events/orcamento-enviado.event';
import type { OrcamentoGerado } from '../../domain/events/orcamento-gerado.event';

/**
 * Leva a OS de UNDER_DIAGNOSIS a AWAITING_APPROVAL quando o orçamento fica pronto. In-process,
 * chega por OrcamentoEnviado (GerarOrcamentoHandler, até a #330 tirar o orçamento do OS); pelo
 * broker, por OrcamentoGerado do Billing, via `handleOrcamentoGerado`.
 *
 * Guarda (ADR-0018): RECEIVED é "ainda-não" (o diagnóstico não foi consumido), falha
 * retentável; de AWAITING_APPROVAL em diante é "já-passou", ack. A gravação é condicionada a
 * UNDER_DIAGNOSIS no próprio UPDATE, então duas entregas não gravam duas vezes.
 */
@Injectable()
export class AtualizarStatusAguardandoAprovacaoHandler {
  private readonly logger = new Logger(AtualizarStatusAguardandoAprovacaoHandler.name);

  constructor(private readonly ordemServicoRepository: IOrdemServicoRepository) {}

  @OnEvent('OrcamentoEnviado')
  async handle(evento: OrcamentoEnviado): Promise<void> {
    await this.aguardarAprovacao(evento.ordemServicoId, 'OrcamentoEnviado');
  }

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
