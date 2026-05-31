import { Injectable } from '@nestjs/common';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IPedidoFornecedorRepository } from '../../domain/interfaces/pedido-fornecedor.repository.interface';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { EstoqueAtualizadoAposRecebimento } from '../../domain/events/estoque-atualizado-apos-recebimento.event';

export interface ReceberPecasCommand {
  pedidoId: string;
}

@Injectable()
export class ReceberPecasFornecedorPolicy {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly pedidoFornecedorRepository: IPedidoFornecedorRepository,
    private readonly emissor: EmissorEventos
  ) {}

  async execute(cmd: ReceberPecasCommand): Promise<void> {
    const pedido = await this.pedidoFornecedorRepository.findById(cmd.pedidoId);
    if (!pedido) {
      throw new EntityNotFoundException('PedidoFornecedor', cmd.pedidoId);
    }
    if (pedido.status === 'RECEBIDO') {
      throw new DomainException('Pedido já foi recebido');
    }

    const atualizadas: Array<{ pecaId: string; novaQuantidade: number }> = [];

    for (const item of pedido.itens) {
      const peca = await this.pecaInsumoRepository.findOne(item.id_peca);
      if (!peca) continue;

      peca.receberDoFornecedor(item.quantidade_solicitada);
      await this.pecaInsumoRepository.updateEstoque(peca.id, peca.quantidade_estoque);
      atualizadas.push({ pecaId: peca.id, novaQuantidade: peca.quantidade_estoque });
    }

    pedido.status = 'RECEBIDO';
    await this.pedidoFornecedorRepository.save(pedido);

    await this.emissor.emitir(new EstoqueAtualizadoAposRecebimento(atualizadas));
  }
}
