import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  formatPaginatedResponse,
  buildSearchWhere,
} from '../../../../shared/infrastructure/database/repository.utils';
import { Cliente } from '../../domain/entities/cliente.entity';
import {
  IClienteRepository,
  CreateClienteInput,
  UpdateClienteInput,
} from '../../domain/interfaces/cliente.interface';
import { ClienteMapper, ClienteORMEntity } from '../persistence/cliente.orm-entity';

@Injectable()
export class ClienteRepository implements IClienteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateClienteInput): Promise<Cliente> {
    const cliente = Cliente.criar({
      id: randomUUID(),
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      documento: data.documento,
      tipoDocumento: data.tipoDocumento,
    });

    const ormData = ClienteMapper.toOrm(cliente);
    const ormEntity = await this.prisma.cliente.create({
      data: {
        nome: ormData.nome,
        email: ormData.email,
        telefone: ormData.telefone,
        documento: ormData.documento,
        tipo_documento: ormData.tipo_documento,
      },
    });

    return ClienteMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<{
    data: Cliente[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = buildSearchWhere(['nome', 'email', 'documento'], search) || {};

    const [ormData, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return formatPaginatedResponse(
      ormData.map((d) => ClienteMapper.toDomain(this.mapToORMEntity(d))),
      page,
      limit,
      total
    );
  }

  async findById(id: string): Promise<Cliente> {
    const ormEntity = await this.prisma.cliente.findUnique({
      where: { id },
      include: { veiculos: true },
    });

    if (!ormEntity) {
      throw new NotFoundException(`Cliente com ID ${id} nao encontrado`);
    }

    return ClienteMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  async update(id: string, data: UpdateClienteInput): Promise<Cliente> {
    await this.findById(id);

    const ormEntity = await this.prisma.cliente.update({
      where: { id },
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
      },
    });

    return ClienteMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  async remove(id: string): Promise<Cliente> {
    await this.findById(id);

    const ormEntity = await this.prisma.cliente.delete({
      where: { id },
    });

    return ClienteMapper.toDomain(this.mapToORMEntity(ormEntity));
  }

  private mapToORMEntity(data: {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    documento: string;
    tipo_documento: 'CPF' | 'CNPJ';
    created_at: Date;
    updated_at: Date;
    veiculos?: unknown[];
  }): ClienteORMEntity {
    return {
      id: data.id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      documento: data.documento,
      tipo_documento: data.tipo_documento,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
}
