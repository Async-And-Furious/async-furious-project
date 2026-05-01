import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PecaInsumoRepository } from '@/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { PedidoFornecedorRepository } from '@/modules/pecas-insumos/infrastructure/repositories/pedido-fornecedor.repository';
import { EmissorEventos } from '@/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { EstoqueAtualizadoAposRecebimento } from '@/modules/pecas-insumos/domain/events/estoque-atualizado-apos-recebimento.event';
import { PecaInsumo } from '@/modules/pecas-insumos/domain/entities/peca-insumo.entity';

export interface ReceberPecasCommand {
  pedidoId: string;
}

@Injectable()
export class ReceberPecasFornecedorPolicy {
  constructor(
    private readonly pecaInsumoRepository: PecaInsumoRepository,
    private readonly pedidoFornecedorRepository: PedidoFornecedorRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('FornecedorEnviaPecas')
  async execute(cmd: ReceberPecasCommand): Promise<void> {
    const pedido = await this.pedidoFornecedorRepository.findById(cmd.pedidoId);
    if (!pedido) {
      throw new NotFoundException(`Pedido ${cmd.pedidoId} não encontrado`);
    }
    if (pedido.status === 'RECEBIDO') {
      throw new ConflictException('Pedido já foi recebido');
    }

    const atualizadas: Array<{ pecaId: string; novaQuantidade: number }> = [];

    for (const item of pedido.itens) {
      const pecaRaw = await this.pecaInsumoRepository.findOne(item.id_peca);
      if (!pecaRaw) continue;

      const peca = pecaRaw as unknown as PecaInsumo;
      peca.receberDoFornecedor(item.quantidade_solicitada);
      await this.pecaInsumoRepository.updateEstoque(peca.id, peca.quantidade_estoque);
      atualizadas.push({ pecaId: peca.id, novaQuantidade: peca.quantidade_estoque });
    }

    pedido.status = 'RECEBIDO';
    await this.pedidoFornecedorRepository.save(pedido);

    await this.emissor.emitir(new EstoqueAtualizadoAposRecebimento(atualizadas));
  }
}
