import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Cliente } from '../../domain/entities/cliente.entity';
import { IClienteRepository } from '../../domain/interfaces/cliente.interface';

@Injectable()
export class ClienteRepository implements IClienteRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    tax_id: string;
    tax_id_type: 'CPF' | 'CNPJ';
  }): Promise<Cliente> {
    return (await this.prisma.customer.create({ data })) as unknown as Cliente;
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<{
    data: Cliente[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { tax_id: { contains: search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: data as unknown as Cliente[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Cliente> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { vehicles: true },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente with ID ${id} not found`);
    }

    return customer as unknown as Cliente;
  }

  async update(
    id: string,
    data: { name?: string; email?: string; phone?: string }
  ): Promise<Cliente> {
    await this.findOne(id);

    return this.prisma.customer.update({
      where: { id },
      data,
    }) as unknown as Cliente;
  }

  async remove(id: string): Promise<Cliente> {
    await this.findOne(id);

    return this.prisma.customer.delete({
      where: { id },
    }) as unknown as Cliente;
  }
}
