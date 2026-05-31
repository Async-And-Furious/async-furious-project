import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  formatPaginatedResponse,
  buildSearchWhere,
} from '../../../../shared/infrastructure/database/repository.utils';
import { PecaInsumo } from '../../domain/entities/peca-insumo.entity';
import { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';

@Injectable()
export class PecaInsumoRepository implements IPecaInsumoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(record: {
    id: string;
    nome: string;
    codigo: string;
    descricao: string | null;
    preco: unknown;
    quantidade_estoque: number;
    quantidade_minima: number;
    created_at: Date;
    updated_at: Date;
  }): PecaInsumo {
    const entity = new PecaInsumo();
    entity.id = record.id;
    entity.nome = record.nome;
    entity.codigo = record.codigo;
    entity.descricao = record.descricao;
    entity.preco = typeof record.preco === 'object' && record.preco !== null && 'toNumber' in record.preco
      ? (record.preco as { toNumber(): number }).toNumber()
      : Number(record.preco);
    entity.quantidade_estoque = record.quantidade_estoque;
    entity.quantidade_minima = record.quantidade_minima;
    entity.created_at = record.created_at;
    entity.updated_at = record.updated_at;
    return entity;
  }

  async create(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<PecaInsumo> {
    const record = await this.prisma.peca.create({ data });
    return this.mapToEntity(record);
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<{
    data: PecaInsumo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = buildSearchWhere(['nome', 'codigo', 'descricao'], search) || {};

    const [data, total] = await Promise.all([
      this.prisma.peca.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.peca.count({ where }),
    ]);

    return formatPaginatedResponse(data.map((r) => this.mapToEntity(r)), page, limit, total);
  }

  async findOne(id: string): Promise<PecaInsumo> {
    const peca = await this.prisma.peca.findUnique({ where: { id } });

    if (!peca) {
      throw new EntityNotFoundException('PecaInsumo', id);
    }

    return this.mapToEntity(peca);
  }

  async findByOrdemServicoId(ordemServicoId: string): Promise<
    Array<{
      id_peca: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
      quantidade_estoque: number;
      quantidade_minima: number;
    }>
  > {
    const itens = await this.prisma.osPeca.findMany({
      where: { id_ordem_servico: ordemServicoId },
      include: { peca: true },
    });

    return itens.map((item) => ({
      id_peca: item.id_peca,
      quantidade: item.quantidade,
      preco_unitario: Number(item.preco_unitario),
      valor_total: Number(item.valor_total),
      quantidade_estoque: item.peca.quantidade_estoque,
      quantidade_minima: item.peca.quantidade_minima,
    }));
  }

  async update(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number; quantidade_minima?: number }
  ): Promise<PecaInsumo> {
    await this.findOne(id);
    const record = await this.prisma.peca.update({ where: { id }, data });
    return this.mapToEntity(record);
  }

  async updateEstoque(id: string, quantidade: number): Promise<PecaInsumo> {
    await this.findOne(id);
    const record = await this.prisma.peca.update({
      where: { id },
      data: { quantidade_estoque: quantidade },
    });
    return this.mapToEntity(record);
  }

  async remove(id: string): Promise<PecaInsumo> {
    await this.findOne(id);
    const record = await this.prisma.peca.delete({ where: { id } });
    return this.mapToEntity(record);
  }
}
