import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IPedidoFornecedorRepository } from '../../domain/interfaces/pedido-fornecedor.repository.interface';
import type { IEmissorEventos } from '../../../../shared/domain/interfaces/emissor-eventos.interface';
import type { IFornecedorGateway } from '../ports/fornecedor.gateway';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { PedidoFornecedorEnviado } from '../../domain/events/pedido-fornecedor-enviado.event';
import { EstoqueAtualizadoAposRecebimento } from '../../domain/events/estoque-atualizado-apos-recebimento.event';

export class SolicitarPecasAoFornecedorUseCase {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly pedidoFornecedorRepository: IPedidoFornecedorRepository,
    private readonly emissor: IEmissorEventos,
    private readonly fornecedorGateway: IFornecedorGateway
  ) {}

  async execute(cmd: {
    fornecedorId: string;
    pecas: Array<{ pecaId: string; quantidadeSolicitada: number }>;
  }): Promise<void> {
    if (!cmd.pecas?.length) {
      throw new DomainException('Lista de peças não pode estar vazia');
    }

    for (const item of cmd.pecas) {
      const exists = await this.pecaInsumoRepository.findOne(item.pecaId);
      if (!exists) {
        throw new EntityNotFoundException('PecaInsumo', item.pecaId);
      }
    }

    const pedido = await this.pedidoFornecedorRepository.create({
      fornecedor_id: cmd.fornecedorId,
      itens: cmd.pecas.map((p) => ({
        id_peca: p.pecaId,
        quantidade_solicitada: p.quantidadeSolicitada,
      })),
      status: 'PENDENTE',
      criado_em: new Date(),
    });

    await this.fornecedorGateway.enviarPedido({
      pedidoId: pedido.id,
      fornecedorId: cmd.fornecedorId,
      itens: cmd.pecas.map((p) => ({
        pecaId: p.pecaId,
        quantidadeSolicitada: p.quantidadeSolicitada,
      })),
    });

    await this.emissor.emitir(
      new PedidoFornecedorEnviado(
        pedido.id,
        cmd.fornecedorId,
        cmd.pecas.map((p) => ({ pecaId: p.pecaId, quantidadeSolicitada: p.quantidadeSolicitada }))
      )
    );
  }
}

export class ReceberPecasDoFornecedorUseCase {
  constructor(
    private readonly pedidoFornecedorRepository: IPedidoFornecedorRepository,
    private readonly emissor: IEmissorEventos
  ) {}

  async execute(cmd: { pedidoId: string }): Promise<void> {
    const pedido = await this.pedidoFornecedorRepository.findById(cmd.pedidoId);
    if (!pedido) {
      throw new EntityNotFoundException('PedidoFornecedor', cmd.pedidoId);
    }
    if (pedido.status === 'RECEBIDO') {
      throw new DomainException('Pedido já foi recebido');
    }

    // Status e estoque mudam juntos numa transação; só a primeira chamada recebe.
    const atualizadas = await this.pedidoFornecedorRepository.receberECreditarEstoque(pedido.id);
    if (!atualizadas) {
      throw new DomainException('Pedido já foi recebido');
    }

    await this.emissor.emitir(new EstoqueAtualizadoAposRecebimento(atualizadas));
  }
}
