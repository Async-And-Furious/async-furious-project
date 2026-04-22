import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Veiculo } from '../../domain/entities/veiculo.entity';
import { IVeiculoRepository } from '../../domain/interfaces/veiculo.interface';

@Injectable()
export class VeiculoRepository implements IVeiculoRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    placa: string;
    marca: string;
    modelo: string;
    ano: number;
    cor?: string;
    id_cliente: string;
  }): Promise<Veiculo> {
    return (await this.prisma.vehicle.create({ data })) as unknown as Veiculo;
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<{
    data: Veiculo[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { placa: { contains: search, mode: 'insensitive' as const } },
            { marca: { contains: search, mode: 'insensitive' as const } },
            { modelo: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { cliente: true },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      data: data as unknown as Veiculo[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Veiculo> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { cliente: true },
    });
    if (!vehicle) throw new NotFoundException(`Veiculo with ID ${id} not found`);
    return vehicle as unknown as Veiculo;
  }

  async findByPlaca(placa: string): Promise<Veiculo | null> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { placa } });
    return vehicle as unknown as Veiculo;
  }

  async update(
    id: string,
    data: { marca?: string; modelo?: string; ano?: number; cor?: string }
  ): Promise<Veiculo> {
    await this.findOne(id);
    return (await this.prisma.vehicle.update({
      where: { id },
      data: data as any,
    })) as unknown as Veiculo;
  }

  async remove(id: string): Promise<Veiculo> {
    await this.findOne(id);
    return (await this.prisma.vehicle.delete({ where: { id } })) as unknown as Veiculo;
  }
}
