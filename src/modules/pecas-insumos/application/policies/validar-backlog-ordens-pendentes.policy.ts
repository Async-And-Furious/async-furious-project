import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoBacklogPort } from '@/shared/domain/interfaces/ordem-servico-backlog.port';
import { ORDEM_SERVICO_BACKLOG_PORT } from '@/shared/domain/interfaces/ordem-servico-backlog.port';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { EstoqueAtualizadoAposRecebimento } from '@/modules/pecas-insumos/domain/events/estoque-atualizado-apos-recebimento.event';
import { BacklogValidadoPecasDisponiveis } from '@/modules/pecas-insumos/domain/events/backlog-validado-pecas-disponiveis.event';

@Injectable()
export class ValidarBacklogOrdensPendentesPolicy {
  constructor(
    @Inject(ORDEM_SERVICO_BACKLOG_PORT)
    private readonly backlogPort: IOrdemServicoBacklogPort,
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('EstoqueAtualizadoAposRecebimento')
  async handle(_event: EstoqueAtualizadoAposRecebimento): Promise<void> {
    const ordens = await this.backlogPort.findAllAguardandoPecas();

    for (const ordem of ordens) {
      const podeLiberar = await this.verificarDisponibilidadeParaOrdem(ordem);
      if (podeLiberar) {
        await this.emissor.emitir(
          new BacklogValidadoPecasDisponiveis(
            ordem.ordemId,
            ordem.pecas.map((p) => ({
              pecaId: p.pecaId,
              quantidadeNecessaria: p.quantidadeNecessaria,
            }))
          )
        );
      }
    }
  }

  private async verificarDisponibilidadeParaOrdem(ordem: {
    ordemId: string;
    pecas: Array<{ pecaId: string; quantidadeNecessaria: number }>;
  }): Promise<boolean> {
    for (const item of ordem.pecas) {
      const peca = await this.pecaInsumoRepository.findOne(item.pecaId);
      if (!peca) return false;
      if (!peca.podeAtenderReserva(item.quantidadeNecessaria)) return false;
    }
    return true;
  }
}
