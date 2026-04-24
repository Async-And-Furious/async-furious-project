import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Servico } from '../../domain/entities/servico.entity';
import { IServicoRepository } from '../../domain/interfaces/servico.interface';

@Injectable()
export class ServicoRepository implements IServicoRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    nome: string;
    descricao?: string;
    preco: number;
  }): Promise<Servico> {
    return (await this.prisma.servico.create({ data })) as unknown as Servico;
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<{
    data: Servico[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { descricao: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.servico.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.servico.count({ where }),
    ]);

    return {
      data: data as unknown as Servico[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Servico> {
    const servico = await this.prisma.servico.findUnique({
      where: { id },
    });
    if (!servico) throw new NotFoundException(`Servico with ID ${id} not found`);
    return servico as unknown as Servico;
  }

  async update(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number }
  ): Promise<Servico> {
    await this.findOne(id);
    return (await this.prisma.servico.update({
      where: { id },
      data,
    })) as unknown as Servico;
  }

  async remove(id: string): Promise<Servico> {
    await this.findOne(id);
    return (await this.prisma.servico.delete({ where: { id } })) as unknown as Servico;
  }
}