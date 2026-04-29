import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { ReservaEstoque } from '@/modules/pecas-insumos/domain/entities/reserva-estoque.entity';
import { IReservaEstoqueRepository } from '@/modules/pecas-insumos/domain/interfaces/reserva-estoque.repository.interface';

@Injectable()
export class ReservaEstoqueRepository implements IReservaEstoqueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: {
    ordem_id: string;
    peca_id: string;
    quantidade: number;
  }): Promise<ReservaEstoque> {
    const reserva = await this.prisma.reservaEstoque.create({
      data: {
        ordem_id: data.ordem_id,
        peca_id: data.peca_id,
        quantidade: data.quantidade,
        reservado_em: new Date(),
      },
    });
    return {
      id: reserva.id,
      ordem_id: reserva.ordem_id,
      peca_id: reserva.peca_id,
      quantidade: reserva.quantidade,
      reservado_em: reserva.reservado_em,
    };
  }

  async existsByOrdemId(ordemId: string): Promise<boolean> {
    const count = await this.prisma.reservaEstoque.count({
      where: { ordem_id: ordemId },
    });
    return count > 0;
  }

  async findByOrdemId(ordemId: string): Promise<ReservaEstoque[]> {
    const reservas = await this.prisma.reservaEstoque.findMany({
      where: { ordem_id: ordemId },
    });
    return reservas.map((r) => ({
      id: r.id,
      ordem_id: r.ordem_id,
      peca_id: r.peca_id,
      quantidade: r.quantidade,
      reservado_em: r.reservado_em,
    }));
  }
}
