import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import {
  IOrdemServicoRepository,
  OrdemServicoUpdateData,
} from '../../domain/interfaces/ordem-servico.interface';

@Injectable()
export class OrdemServicoRepository implements IOrdemServicoRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    id_veiculo: string;
    id_cliente: string;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    return (await this.prisma.serviceOrder.create({ data })) as unknown as OrdemDeServico;
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
      this.prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { veiculo: true, cliente: true },
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      data: data as unknown as OrdemDeServico[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<OrdemDeServico> {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: { veiculo: true, cliente: true },
    });
    if (!order) throw new NotFoundException(`OrdemDeServico with ID ${id} not found`);
    return order as unknown as OrdemDeServico;
  }

  async update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.serviceOrder.update({
      where: { id },
      data,
    })) as unknown as OrdemDeServico;
  }

  async remove(id: string): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.serviceOrder.delete({
      where: { id },
    })) as unknown as OrdemDeServico;
  }
}
