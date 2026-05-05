import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PecaInsumoRepository } from '@/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { ReservaEstoqueRepository } from '@/modules/pecas-insumos/infrastructure/repositories/reserva-estoque.repository';
import { EmissorEventos } from '@/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PecasReservadas } from '@/modules/pecas-insumos/domain/events/pecas-reservadas.event';
import { PecaInsumo } from '@/modules/pecas-insumos/domain/entities/peca-insumo.entity';

@Injectable()
export class LiberarOrdensAguardandoPecasPolicy {
  constructor(
    private readonly pecaInsumoRepository: PecaInsumoRepository,
    private readonly reservaEstoqueRepository: ReservaEstoqueRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('BacklogValidadoPecasDisponiveis')
  async handle(payload: {
    ordemId: string;
    pecas: Array<{ pecaId: string; quantidadeNecessaria: number }>;
  }): Promise<void> {
    const jaReservado = await this.reservaEstoqueRepository.existsByOrdemId(payload.ordemId);
    if (jaReservado) return;

    const pecasReservadas: Array<{ id_peca: string; quantidade: number }> = [];

    for (const item of payload.pecas) {
      const pecaRaw = await this.pecaInsumoRepository.findOne(item.pecaId);
      if (!pecaRaw) {
        throw new NotFoundException(`Peça ${item.pecaId} não encontrada durante liberação`);
      }
      const peca = pecaRaw as unknown as PecaInsumo;
      peca.debitarEstoque(item.quantidadeNecessaria);
      await this.pecaInsumoRepository.updateEstoque(peca.id, peca.quantidade_estoque);
      await this.reservaEstoqueRepository.save({
        ordem_id: payload.ordemId,
        peca_id: peca.id,
        quantidade: item.quantidadeNecessaria,
      });
      pecasReservadas.push({ id_peca: peca.id, quantidade: item.quantidadeNecessaria });
    }

    await this.emissor.emitir(new PecasReservadas(payload.ordemId, pecasReservadas));
  }
}
