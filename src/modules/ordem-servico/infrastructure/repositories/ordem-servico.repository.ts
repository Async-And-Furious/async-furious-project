import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  formatPaginatedResponse,
  buildSearchWhere,
} from '../../../../shared/infrastructure/database/repository.utils';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import {
  IOrdemServicoRepository,
  OrdemServicoUpdateData,
} from '../../domain/interfaces/ordem-servico.interface';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';
import {
  STATUS_EXCLUIDOS_DA_LISTAGEM,
  getPrioridadeStatus,
} from '../../domain/policies/status-priority.policy';

@Injectable()
export class OrdemServicoRepository implements IOrdemServicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(record: {
    id: string;
    id_veiculo: string;
    id_cliente: string;
    status: string;
    descricao: string | null;
    iniciada_em: Date | null;
    finalizada_em: Date | null;
    entregue_em: Date | null;
    created_at: Date;
    updated_at: Date;
    orcamento?: unknown;
    veiculo?: unknown;
    cliente?: unknown;
  }): OrdemDeServico {
    const entity = new OrdemDeServico();
    entity.id = record.id;
    entity.veiculoId = record.id_veiculo;
    entity.clienteId = record.id_cliente;
    entity.status = record.status as OrdemDeServico['status'];
    entity.descricao = record.descricao;
    entity.iniciada_em = record.iniciada_em;
    entity.finalizada_em = record.finalizada_em;
    entity.entregue_em = record.entregue_em;
    entity.created_at = record.created_at;
    entity.updated_at = record.updated_at;
    if (record.orcamento !== undefined) {
      entity.orcamento = record.orcamento as OrdemDeServico['orcamento'];
    }
    return entity;
  }

  async create(data: {
    veiculoId: string;
    clienteId: string;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    const record = await this.prisma.ordemServico.create({
      data: {
        id: randomUUID(),
        id_veiculo: data.veiculoId,
        id_cliente: data.clienteId,
        descricao: data.descricao,
        status: 'RECEIVED',
      },
    });
    return this.mapToEntity(record);
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = buildSearchWhere(['descricao'], search) || {};

    const [data, total] = await Promise.all([
      this.prisma.ordemServico.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { veiculo: true, cliente: true, orcamento: true },
      }),
      this.prisma.ordemServico.count({ where }),
    ]);

    return formatPaginatedResponse(data.map((r) => this.mapToEntity(r)), page, limit, total);
  }

  async findAllAtivas(
    page = 1,
    limit = 10
  ): Promise<{
    data: OrdemDeServico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = { status: { notIn: STATUS_EXCLUIDOS_DA_LISTAGEM } };

    const [records, total] = await Promise.all([
      this.prisma.ordemServico.findMany({
        where,
        orderBy: { created_at: 'asc' },
        include: { orcamento: true },
      }),
      this.prisma.ordemServico.count({ where }),
    ]);

    const sorted = records
      .map((r) => this.mapToEntity(r))
      .sort((a, b) => getPrioridadeStatus(a.status) - getPrioridadeStatus(b.status));

    const paginated = sorted.slice((page - 1) * limit, page * limit);
    return formatPaginatedResponse(paginated, page, limit, total);
  }

  async findOne(id: string): Promise<OrdemDeServico> {
    const record = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: { veiculo: true, cliente: true, orcamento: true },
    });
    if (!record) throw new EntityNotFoundException('OrdemDeServico', id);
    return this.mapToEntity(record);
  }

  async update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico> {
    await this.findOne(id);
    const record = await this.prisma.ordemServico.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.iniciada_em !== undefined && { iniciada_em: data.iniciada_em }),
        ...(data.finalizada_em !== undefined && { finalizada_em: data.finalizada_em }),
        ...(data.entregue_em !== undefined && { entregue_em: data.entregue_em }),
      },
    });
    return this.mapToEntity(record);
  }

  async remove(id: string): Promise<OrdemDeServico> {
    await this.findOne(id);
    const record = await this.prisma.ordemServico.delete({ where: { id } });
    return this.mapToEntity(record);
  }

  async calcularTempoMedioExecucao(): Promise<{ totalMinutos: number; total: number }> {
    const ordens = await this.prisma.ordemServico.findMany({
      where: {
        status: 'DELIVERED',
        iniciada_em: { not: null },
        finalizada_em: { not: null },
      },
      select: { iniciada_em: true, finalizada_em: true },
    });

    if (ordens.length === 0) return { totalMinutos: 0, total: 0 };

    const totalMinutos = ordens.reduce((acc, os) => {
      const diff = os.finalizada_em!.getTime() - os.iniciada_em!.getTime();
      return acc + diff / 60000;
    }, 0);

    return { totalMinutos, total: ordens.length };
  }
}
