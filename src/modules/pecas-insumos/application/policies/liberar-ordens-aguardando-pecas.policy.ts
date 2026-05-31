import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IReservaEstoqueRepository } from '../../domain/interfaces/reserva-estoque.repository.interface';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { PecasReservadas } from '../../domain/events/pecas-reservadas.event';

@Injectable()
export class LiberarOrdensAguardandoPecasPolicy {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly reservaEstoqueRepository: IReservaEstoqueRepository,
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
      const peca = await this.pecaInsumoRepository.findOne(item.pecaId);
      if (!peca) {
        throw new EntityNotFoundException('PecaInsumo', item.pecaId);
      }
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
