import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { PecasEmEstoqueConfirmadas } from '../../domain/events/pecas-em-estoque-confirmadas.event';
import { EstoqueDebitado } from '../../domain/events/estoque-debitado.event';
import { PecasReservadas } from '../../domain/events/pecas-reservadas.event';

@Injectable()
export class DebitarEstoqueHandler {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('PecasEmEstoqueConfirmadas')
  async handle(evento: PecasEmEstoqueConfirmadas): Promise<void> {
    for (const item of evento.pecas) {
      const peca = await this.pecaInsumoRepository.findOne(item.id_peca);
      peca.debitarEstoque(item.quantidade);
      await this.pecaInsumoRepository.updateEstoque(peca.id, peca.quantidade_estoque);
    }

    const itensDebitados = evento.pecas.map((item) => ({
      id_peca: item.id_peca,
      quantidade: item.quantidade,
    }));

    await this.emissor.emitir(new EstoqueDebitado(evento.ordemServicoId, itensDebitados));
    await this.emissor.emitir(new PecasReservadas(evento.ordemServicoId, itensDebitados));
  }
}
