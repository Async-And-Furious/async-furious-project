import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PedidoFornecedor } from '@/modules/pecas-insumos/domain/entities/pedido-fornecedor.entity';
import { IPedidoFornecedorRepository } from '@/modules/pecas-insumos/domain/interfaces/pedido-fornecedor.repository.interface';

@Injectable()
export class PedidoFornecedorRepository implements IPedidoFornecedorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    fornecedor_id: string;
    itens: Array<{ id_peca: string; quantidade_solicitada: number }>;
    status: 'PENDENTE';
    criado_em: Date;
  }): Promise<PedidoFornecedor> {
    const pedido = await this.prisma.pedidoFornecedor.create({
      data: {
        fornecedor_id: data.fornecedor_id,
        status: data.status,
        criado_em: data.criado_em,
        itens: {
          createMany: {
            data: data.itens.map((item) => ({
              id_peca: item.id_peca,
              quantidade_solicitada: item.quantidade_solicitada,
              quantidade_recebida: 0,
            })),
          },
        },
      },
      include: { itens: true },
    });
    return this.mapToEntity(pedido);
  }

  async findById(id: string): Promise<PedidoFornecedor | null> {
    const pedido = await this.prisma.pedidoFornecedor.findUnique({
      where: { id },
      include: { itens: true },
    });
    return pedido ? this.mapToEntity(pedido) : null;
  }

  async save(pedido: PedidoFornecedor): Promise<PedidoFornecedor> {
    const updated = await this.prisma.pedidoFornecedor.update({
      where: { id: pedido.id },
      data: {
        status: pedido.status,
        atualizado_em: new Date(),
      },
      include: { itens: true },
    });
    return this.mapToEntity(
      updated as Prisma.PedidoFornecedorGetPayload<{ include: { itens: true } }>
    );
  }

  async findAll(): Promise<PedidoFornecedor[]> {
    const pedidos = await this.prisma.pedidoFornecedor.findMany({
      include: { itens: true },
      orderBy: { criado_em: 'desc' },
    });
    return pedidos.map((p) => this.mapToEntity(p));
  }

  private mapToEntity(
    raw: Prisma.PedidoFornecedorGetPayload<{ include: { itens: true } }>
  ): PedidoFornecedor {
    return {
      id: raw!.id,
      fornecedor_id: raw!.fornecedor_id,
      status: raw!.status as 'PENDENTE' | 'RECEBIDO',
      criado_em: raw!.criado_em,
      atualizado_em: raw!.atualizado_em,
      itens: raw!.itens.map((item) => ({
        id: item.id,
        id_pedido_fornecedor: item.id_pedido_fornecedor,
        id_peca: item.id_peca,
        quantidade_solicitada: item.quantidade_solicitada,
        quantidade_recebida: item.quantidade_recebida,
      })),
    };
  }
}
