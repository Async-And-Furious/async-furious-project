import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { PecaInsumo } from '../../domain/entities/peca-insumo.entity';
import { IPecaInsumoRepository } from '../../domain/interfaces/peca-insumo.interface';

@Injectable()
export class PecaInsumoRepository implements IPecaInsumoRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    nome: string;
    codigo: string;
    descricao?: string;
    preco: number;
    quantidade_estoque?: number;
    quantidade_minima?: number;
  }): Promise<PecaInsumo> {
    return (await this.prisma.peca.create({ data })) as unknown as PecaInsumo;
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{
    data: PecaInsumo[];
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
      data: data as unknown as PecaInsumo[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<PecaInsumo> {
    const peca = await this.prisma.peca.findUnique({ where: { id } });

    if (!peca) {
      throw new NotFoundException(`PecaInsumo with ID ${id} not found`);
    }

    return peca as unknown as PecaInsumo;
  }

  async update(
    id: string,
    data: { nome?: string; descricao?: string; preco?: number; quantidade_minima?: number },
  ): Promise<PecaInsumo> {
    await this.findOne(id);

    return this.prisma.peca.update({ where: { id }, data }) as unknown as PecaInsumo;
  }

  async updateEstoque(id: string, quantidade: number): Promise<PecaInsumo> {
    await this.findOne(id);

    return this.prisma.peca.update({
      where: { id },
      data: { quantidade_estoque: quantidade },
    }) as unknown as PecaInsumo;
  }

  async remove(id: string): Promise<PecaInsumo> {
    await this.findOne(id);

    return this.prisma.peca.delete({ where: { id } }) as unknown as PecaInsumo;
  }
}
