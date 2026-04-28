import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
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
    const skip = (page - 1) * limit;
    const where = search ? { descricao: { contains: search, mode: 'insensitive' as const } } : {};

    const [data, total] = await Promise.all([
      this.prisma.ordemServico.findMany({
        where,
        skip,
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

    return {
      data: data as unknown as OrdemDeServico[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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
      },
    })) as unknown as OrdemDeServico;
  }

  async remove(id: string): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.ordemServico.delete({
      where: { id },
    })) as unknown as OrdemDeServico;
  }
}
