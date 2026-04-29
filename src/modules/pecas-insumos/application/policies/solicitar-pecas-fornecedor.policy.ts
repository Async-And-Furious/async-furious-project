import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PecaInsumoRepository } from '@/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { PedidoFornecedorRepository } from '@/modules/pecas-insumos/infrastructure/repositories/pedido-fornecedor.repository';
import { EmissorEventos } from '@/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { PedidoFornecedorEnviado } from '@/modules/pecas-insumos/domain/events/pedido-fornecedor-enviado.event';

export interface SolicitarReposicaoCommand {
  fornecedorId: string;
  pecas: Array<{ pecaId: string; quantidadeSolicitada: number }>;
}

@Injectable()
export class SolicitarPecasFornecedorPolicy {
  constructor(
    private readonly pecaInsumoRepository: PecaInsumoRepository,
    private readonly pedidoFornecedorRepository: PedidoFornecedorRepository,
    private readonly emissor: EmissorEventos
  ) {}

  @OnEvent('AdminSolicitaReposicao')
  async execute(cmd: SolicitarReposicaoCommand): Promise<void> {
    if (!cmd.pecas?.length) {
      throw new BadRequestException('Lista de peças não pode estar vazia');
    }

    for (const item of cmd.pecas) {
      const exists = await this.pecaInsumoRepository.findOne(item.pecaId);
      if (!exists) {
        throw new NotFoundException(`Peça ${item.pecaId} não encontrada no catálogo`);
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
