import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import { IOrdemServicoRepository } from '../../domain/interfaces/ordem-servico.interface';

@Injectable()
export class OrdemServicoRepository implements IOrdemServicoRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    vehicle_id: string;
    customer_id: string;
    description?: string;
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
    const where = search
      ? { description: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { vehicle: true, customer: true },
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
      include: { vehicle: true, customer: true },
    });
    if (!order) throw new NotFoundException(`OrdemDeServico with ID ${id} not found`);
    return order as unknown as OrdemDeServico;
  }

  async update(
    id: string,
    data: { status?: OrdemDeServico['status']; description?: string }
  ): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.serviceOrder.update({
      where: { id },
      data: data as any,
    })) as unknown as OrdemDeServico;
  }

  async remove(id: string): Promise<OrdemDeServico> {
    await this.findOne(id);
    return (await this.prisma.serviceOrder.delete({
      where: { id },
    })) as unknown as OrdemDeServico;
  }
}
