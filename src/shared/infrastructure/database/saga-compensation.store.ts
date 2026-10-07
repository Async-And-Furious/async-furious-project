import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { ISagaCompensationStore } from '../../application/saga-compensation.store';

@Injectable()
export class SagaCompensationStore implements ISagaCompensationStore {
  constructor(private readonly prisma: PrismaService) {}

  async claimEvent(eventId: string, ordemServicoId: string): Promise<boolean> {
    const lockedUntil = new Date(Date.now() + 60_000);
    try {
      await this.prisma.sagaEventReceipt.create({ data: { eventId, ordemServicoId, lockedUntil } });
      return true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const claimed = await this.prisma.sagaEventReceipt.updateMany({
        where: { eventId, status: { not: 'COMPLETED' }, lockedUntil: { lt: new Date() } },
        data: { status: 'PROCESSING', lockedUntil },
      });
      return claimed.count === 1;
    }
  }

  async recordEvidence(eventId: string, evidence: string): Promise<void> {
    await this.prisma.sagaEventReceipt.update({ where: { eventId }, data: { status: 'COMPLETED', evidence } });
  }

  async prepareRefund(paymentId: string, amount: number): Promise<boolean> {
    const result = await this.prisma.refundOperation.createMany({
      data: { paymentId, idempotencyKey: `refund:${paymentId}`, amount },
      skipDuplicates: true,
    });
    if (result.count === 1) return true;
    return !(await this.refundCompleted(paymentId));
  }

  async completeRefund(paymentId: string): Promise<void> {
    await this.prisma.refundOperation.update({ where: { paymentId }, data: { status: 'COMPLETED' } });
  }

  async refundCompleted(paymentId: string): Promise<boolean> {
    const operation = await this.prisma.refundOperation.findUnique({ where: { paymentId } });
    return operation?.status === 'COMPLETED';
  }

  async completeSaga(ordemServicoId: string, eventId: string, compensacoes: string[]): Promise<boolean> {
    const result = await this.prisma.sagaCompletion.createMany({
      data: { ordemServicoId, eventId, compensacoes },
      skipDuplicates: true,
    });
    await this.prisma.sagaEventReceipt.updateMany({ where: { eventId }, data: { status: 'COMPLETED' } });
    return result.count === 1;
  }
}
