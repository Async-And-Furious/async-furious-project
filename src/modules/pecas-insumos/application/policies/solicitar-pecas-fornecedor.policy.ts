import { Injectable } from '@nestjs/common';
import type { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';
import type { IPedidoFornecedorRepository } from '../../domain/interfaces/pedido-fornecedor.repository.interface';
import { EmissorEventos } from '../../../../shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { PedidoFornecedorEnviado } from '../../domain/events/pedido-fornecedor-enviado.event';

export interface SolicitarReposicaoCommand {
  fornecedorId: string;
  pecas: Array<{ pecaId: string; quantidadeSolicitada: number }>;
}

@Injectable()
export class SolicitarPecasFornecedorPolicy {
  constructor(
    private readonly pecaInsumoRepository: IPecaInsumoRepository,
    private readonly pedidoFornecedorRepository: IPedidoFornecedorRepository,
    private readonly emissor: EmissorEventos
  ) {}

  async execute(cmd: SolicitarReposicaoCommand): Promise<void> {
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

    await this.emissor.emitir(
      new PedidoFornecedorEnviado(
        pedido.id,
        cmd.fornecedorId,
        cmd.pecas.map((p) => ({ pecaId: p.pecaId, quantidadeSolicitada: p.quantidadeSolicitada }))
      )
    );
  }
}
