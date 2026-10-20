import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Pagamento } from '../../domain/entities/pagamento.entity';
import { IPagamentoRepository } from '../../domain/interfaces/pagamento.interface';
import { PagamentoMapper } from '../persistence/pagamento.orm.entity';

@Injectable()
export class PagamentoRepository implements IPagamentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(pagamento: Pagamento): Promise<void> {
    const data = PagamentoMapper.toOrm(pagamento);

    await this.prisma.pagamento.upsert({
      where: { id: data.id },
      update: {
        status: data.status,
        preferenceId: data.preferenceId,
        linkPagamento: data.linkPagamento,
      },
      create: data,
    });
  }

  async findCobrancaByOrdemServicoId(ordemServicoId: string): Promise<Pagamento | null> {
    const record = await this.prisma.pagamento.findFirst({
      where: { ordemServicoId, linkPagamento: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return null;

    return PagamentoMapper.toDomain(record);
  }

  async findById(id: string): Promise<Pagamento | null> {
    const record = await this.prisma.pagamento.findUnique({
      where: { id },
    });

    if (!record) return null;

    return PagamentoMapper.toDomain(record);
  }
}
