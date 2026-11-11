import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import { PecasEmEstoqueConfirmadas } from '../../domain/events/pecas-em-estoque-confirmadas.event';
import { EstoqueDebitado } from '../../domain/events/estoque-debitado.event';
import { PecasReservadas } from '../../domain/events/pecas-reservadas.event';
import { PecasNaoExistem } from '../../domain/events/pecas-nao-existem.event';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';

@Injectable()
export class DebitarEstoqueHandler {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  @OnEvent('PecasEmEstoqueConfirmadas')
  async handle(evento: PecasEmEstoqueConfirmadas): Promise<void> {
    const itensDebitados = evento.pecas.map((item) => ({
      id_peca: item.id_peca,
      quantidade: item.quantidade,
    }));
    if (itensDebitados.some((item) => item.quantidade <= 0)) {
      throw new DomainException('Quantidade a debitar deve ser positiva');
    }

    // Débito tudo ou nada. Se o saldo acabou entre a verificação e o débito
    // (outra OS levou a peça), segue o mesmo caminho de peça indisponível. O débito grava a
    // reserva da OS, que a compensação da saga devolve ao estoque (#338).
    const { indisponiveis } = await this.pecaInsumoRepository.debitarEstoqueAtomico(
      evento.ordemServicoId,
      itensDebitados
    );
    if (indisponiveis.length > 0) {
      await this.emissor.emitir(new PecasNaoExistem(evento.ordemServicoId, indisponiveis));
      return;
    }

    await this.emissor.emitir(new EstoqueDebitado(evento.ordemServicoId, itensDebitados));
    await this.emissor.emitir(new PecasReservadas(evento.ordemServicoId, itensDebitados));
  }
}
