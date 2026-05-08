import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class OrdemServicoRepository implements IOrdemServicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    veiculoId: string;
    clienteId: string;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    const entity = await this.prisma.ordemServico.create({
      data: {
        id: randomUUID(),
        id_veiculo: data.veiculoId,
        id_cliente: data.clienteId,
        descricao: data.descricao,
        status: 'RECEIVED',
      },
    });
    return entity as unknown as OrdemDeServico;
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
        include: {
          veiculo: true,
          cliente: true,
          orcamento: true,
        },
      }),
      this.prisma.ordemServico.count({ where }),
    ]);

    return formatPaginatedResponse(data as unknown as OrdemDeServico[], page, limit, total);
  }

  async findOne(id: string): Promise<OrdemDeServico> {
    const order = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: { veiculo: true, cliente: true, orcamento: true },
    });
    if (!order) throw new NotFoundException(`Ordem de Serviço com ID ${id} não encontrada`);
    return order as unknown as OrdemDeServico;
  }

  async update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.ordemServico.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.iniciada_em !== undefined && { iniciada_em: data.iniciada_em }),
        ...(data.finalizada_em !== undefined && { finalizada_em: data.finalizada_em }),
        ...(data.entregue_em !== undefined && { entregue_em: data.entregue_em }),
      },
    })) as unknown as OrdemDeServico;
  }

  async remove(id: string): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.ordemServico.delete({
      where: { id },
    })) as unknown as OrdemDeServico;
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
