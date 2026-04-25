import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Veiculo } from '../../domain/entities/veiculo.entity';
import {
  IVeiculoRepository,
  CreateVeiculoInput,
  UpdateVeiculoInput,
} from '../../domain/interfaces/veiculo.interface';
import { VeiculoMapper, VeiculoORMEntity } from '../persistence/veiculo.orm-entity';

@Injectable()
export class VeiculoRepository implements IVeiculoRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateVeiculoInput): Promise<Veiculo> {
    const veiculo = Veiculo.criar({
      id: randomUUID(),
      placa: data.placa,
      marca: data.marca,
      modelo: data.modelo,
      ano: data.ano,
      cor: data.cor,
      clienteId: data.clienteId,
    });

    const ormData = VeiculoMapper.toOrm(veiculo);
    const ormEntity = await this.prisma.veiculo.create({
      data: {
        placa: ormData.placa,
        marca: ormData.marca,
        modelo: ormData.modelo,
        ano: ormData.ano,
        cor: ormData.cor,
        id_cliente: ormData.id_cliente,
      },
    });

    return VeiculoMapper.toDomain(this.mapToORMEntity(ormEntity));
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

    const [ormData, total] = await Promise.all([
      this.prisma.veiculo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.veiculo.count({ where }),
    ]);

    return {
      data: ormData.map((d) => VeiculoMapper.toDomain(this.mapToORMEntity(d))),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Veiculo> {
    const ormEntity = await this.prisma.veiculo.findUnique({
      where: { id },
    });

    if (!ormEntity) {
      throw new NotFoundException(`Veiculo com ID ${id} nao encontrado`);
    }

    return VeiculoMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  async findByPlaca(placa: string): Promise<Veiculo | null> {
    const ormEntity = await this.prisma.veiculo.findUnique({ where: { placa } });
    if (!ormEntity) return null;
    return VeiculoMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  async update(id: string, data: UpdateVeiculoInput): Promise<Veiculo> {
    await this.findById(id);

    const ormEntity = await this.prisma.veiculo.update({
      where: { id },
      data: {
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cor: data.cor,
      },
    });

    return VeiculoMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  async remove(id: string): Promise<Veiculo> {
    await this.findById(id);

    const ormEntity = await this.prisma.veiculo.delete({
      where: { id },
    });

    return VeiculoMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  private mapToORMEntity(data: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano: number;
    cor: string | null;
    id_cliente: string;
    created_at: Date;
    updated_at: Date;
  }): VeiculoORMEntity {
    return {
      id: data.id,
      placa: data.placa,
      marca: data.marca,
      modelo: data.modelo,
      ano: data.ano,
      cor: data.cor,
      id_cliente: data.id_cliente,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
}
