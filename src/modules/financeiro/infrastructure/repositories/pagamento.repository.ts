import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { Pagamento } from '../../domain/entities/pagamento.entity';
import type {
  IPagamentoRepository,
  NotificacaoRecebida,
} from '../../domain/interfaces/pagamento.interface';
import { PagamentoMapper } from '../persistence/pagamento.orm.entity';

const violouUnicidade = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

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
        mercadoPagoPaymentId: data.mercadoPagoPaymentId,
      },
      create: data,
    });
  }

  async findById(id: string): Promise<Pagamento | null> {
    const record = await this.prisma.pagamento.findUnique({
      where: { id },
    });

    if (!record) return null;

    return PagamentoMapper.toDomain(record);
  }

  async findByOrdemServicoId(ordemServicoId: string): Promise<Pagamento | null> {
    const record = await this.prisma.pagamento.findUnique({
      where: { ordemServicoId },
    });

    if (!record) return null;

    return PagamentoMapper.toDomain(record);
  }

  async reservar(pagamento: Pagamento): Promise<boolean> {
    try {
      await this.prisma.pagamento.create({ data: PagamentoMapper.toOrm(pagamento) });
      return true;
    } catch (error) {
      if (violouUnicidade(error)) return false;
      throw error;
    }
  }

  async remover(id: string): Promise<void> {
    await this.prisma.pagamento.deleteMany({ where: { id } });
  }

  async saveComNotificacao(
    pagamento: Pagamento,
    notificacao: NotificacaoRecebida
  ): Promise<boolean> {
    const data = PagamentoMapper.toOrm(pagamento);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.webhookRecebido.create({
          data: { providerEventId: notificacao.providerEventId, tipo: notificacao.tipo },
        });
        await tx.pagamento.update({
          where: { id: data.id },
          data: { status: data.status, mercadoPagoPaymentId: data.mercadoPagoPaymentId },
        });
      });
      return true;
    } catch (error) {
      if (violouUnicidade(error)) return false;
      throw error;
    }
  }
}
