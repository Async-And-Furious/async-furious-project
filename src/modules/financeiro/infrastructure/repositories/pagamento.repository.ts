import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Pagamento } from '../../domain/entities/pagamento.entity';
import { PagamentoMapper, PagamentoORMEntity } from '../persistence/pagamento.orm.entity';

@Injectable()
export class PagamentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(pagamento: Pagamento): Promise<void> {
    // Usa o Mapper para converter Domínio -> Prisma
    const data = PagamentoMapper.toOrm(pagamento);

    await (this.prisma as any).pagamento.upsert({
      where: { id: data.id },
      update: {
        status: data.status,
      },
      create: data,
    });
  }

  async findById(id: string): Promise<Pagamento | null> {
    const record = await (this.prisma as any).pagamento.findUnique({
      where: { id },
    });

    if (!record) return null;

    // Usa o Mapper para converter Prisma -> Domínio
    return PagamentoMapper.toDomain(record as PagamentoORMEntity);
  }
}
