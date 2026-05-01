import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { OsPeca } from '../../domain/entities/os-peca.entity';
import type { IOsPecaRepository } from '../../domain/interfaces/os-peca.interface';

@Injectable()
export class OsPecaRepository implements IOsPecaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceAll(
    ordemServicoId: string,
    pecas: Array<{
      id_peca: string;
      quantidade: number;
      preco_unitario: number;
      valor_total: number;
    }>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.osPeca.deleteMany({ where: { id_ordem_servico: ordemServicoId } });
      if (pecas.length > 0) {
        await tx.osPeca.createMany({
          data: pecas.map((p) => ({
            id_ordem_servico: ordemServicoId,
            id_peca: p.id_peca,
            quantidade: p.quantidade,
            preco_unitario: p.preco_unitario,
            valor_total: p.valor_total,
          })),
        });
      }
    });
  }

  async findByOrdemServicoId(ordemServicoId: string): Promise<OsPeca[]> {
    const rows = await this.prisma.osPeca.findMany({
      where: { id_ordem_servico: ordemServicoId },
    });
    return rows as unknown as OsPeca[];
  }
}
