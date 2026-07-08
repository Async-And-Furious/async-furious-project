import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { IOsServicoRepository } from '../../domain/interfaces/os-servico.interface';
import { OsServico } from '../../domain/entities/os-servico.entity';

@Injectable()
export class OsServicoRepository implements IOsServicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceAll(
    ordemServicoId: string,
    servicos: Array<{
      id_servico: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
    }>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.osServico.deleteMany({
        where: { id_ordem_servico: ordemServicoId },
      });

      if (servicos.length > 0) {
        await tx.osServico.createMany({
          data: servicos.map((s) => ({
            id_ordem_servico: ordemServicoId,
            id_servico: s.id_servico,
            quantidade: s.quantidade,
            preco_unitario: s.preco_unitario,
            valor_total: s.valor_total,
          })),
        });
      }
    });
  }

  async findByOrdemServicoId(ordemServicoId: string): Promise<OsServico[]> {
    const data = await this.prisma.osServico.findMany({
      where: { id_ordem_servico: ordemServicoId },
    });

    return data.map((d) => ({
      id: d.id,
      id_ordem_servico: d.id_ordem_servico,
      id_servico: d.id_servico,
      quantidade: d.quantidade,
      preco_unitario: Number(d.preco_unitario),
      valor_total: Number(d.valor_total),
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  }
}
