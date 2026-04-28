import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Orcamento } from '../../domain/entities/orcamento.entity';
import type {
  IOrcamentoRepository,
  OrcamentoUpdateData,
} from '../../domain/interfaces/orcamento.interface';

@Injectable()
export class OrcamentoRepository implements IOrcamentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    id_ordem_servico: string;
    valor_total_servicos: number;
    valor_total_pecas: number;
    valor_total_geral: number;
  }): Promise<Orcamento> {
    return (await this.prisma.orcamento.create({ data })) as unknown as Orcamento;
  }

  async findByOrdemServicoId(id_ordem_servico: string): Promise<Orcamento | null> {
    const orcamento = await this.prisma.orcamento.findUnique({
      where: { id_ordem_servico },
    });
    return orcamento as unknown as Orcamento | null;
  }

  async update(id: string, data: OrcamentoUpdateData): Promise<Orcamento> {
    const existing = await this.prisma.orcamento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Orçamento com ID ${id} não encontrado`);
    return (await this.prisma.orcamento.update({
      where: { id },
      data,
    })) as unknown as Orcamento;
  }
}
