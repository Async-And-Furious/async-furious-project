import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Peca } from '../../domain/entities/peca.entity';
import { IPecaRepository } from '../../domain/interfaces/peca.interface';

@Injectable()
export class PecaRepository implements IPecaRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<Peca> {
    return (await this.prisma.peca.create({ data })) as unknown as Peca;
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{
    data: Peca[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { codigo: { contains: search, mode: 'insensitive' as const } },
            { descricao: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.peca.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.peca.count({ where }),
    ]);

    return {
      data: data as unknown as Peca[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Peca> {
    const peca = await this.prisma.peca.findUnique({ where: { id } });

    if (!peca) {
      throw new NotFoundException(`Peça with ID ${id} not found`);
    }

    return peca as unknown as Peca;
  }

  async update(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number; quantidade_minima?: number },
  ): Promise<Peca> {
    await this.findOne(id);

    return this.prisma.peca.update({ where: { id }, data }) as unknown as Peca;
  }

  async updateEstoque(id: string, quantidade: number): Promise<Peca> {
    await this.findOne(id);

    return this.prisma.peca.update({
      where: { id },
      data: { quantidade_estoque: quantidade },
    }) as unknown as Peca;
  }

  async remove(id: string): Promise<Peca> {
    await this.findOne(id);

    return this.prisma.peca.delete({ where: { id } }) as unknown as Peca;
  }
}
