import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IOrdemServicoBacklogPort } from '@/shared/domain/interfaces/ordem-servico-backlog.port';
import { ORDEM_SERVICO_BACKLOG_PORT } from '@/shared/domain/interfaces/ordem-servico-backlog.port';
import { PecaInsumoRepository } from '@/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { EmissorEventos } from '@/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { EstoqueAtualizadoAposRecebimento } from '@/modules/pecas-insumos/domain/events/estoque-atualizado-apos-recebimento.event';
import { BacklogValidadoPecasDisponiveis } from '@/modules/pecas-insumos/domain/events/backlog-validado-pecas-disponiveis.event';
import { PecaInsumo } from '@/modules/pecas-insumos/domain/entities/peca-insumo.entity';

@Injectable()
export class ValidarBacklogOrdensPendentesPolicy {
  constructor(
    @Inject(ORDEM_SERVICO_BACKLOG_PORT)
    private readonly backlogPort: IOrdemServicoBacklogPort,
    private readonly pecaInsumoRepository: PecaInsumoRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('EstoqueAtualizadoAposRecebimento')
  async handle(event: EstoqueAtualizadoAposRecebimento): Promise<void> {
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
      const pecaRaw = await this.pecaInsumoRepository.findOne(item.pecaId);
      if (!pecaRaw) return false;
      const peca = pecaRaw as unknown as PecaInsumo;
      if (!peca.podeAtenderReserva(item.quantidadeNecessaria)) return false;
    }
    return true;
  }
}
