import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { ISagaCompensationStore } from '../../application/saga-compensation.store';
import { randomUUID } from 'node:crypto';

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

  async claimRefund(paymentId: string, amount: number): Promise<{ idempotencyKey: string; fencingToken: string } | null> {
    const now = new Date();
    const fencingToken = randomUUID();
    const lockedUntil = new Date(Date.now() + 60_000);
    const result = await this.prisma.refundOperation.createMany({
      data: { paymentId, idempotencyKey: `refund:${paymentId}`, amount, status: 'PROCESSING', fencingToken, lockedUntil },
      skipDuplicates: true,
    });
    if (result.count === 1) return { idempotencyKey: `refund:${paymentId}`, fencingToken };
    const claimed = await this.prisma.refundOperation.updateMany({
      where: { paymentId, status: { not: 'COMPLETED' }, lockedUntil: { lt: now } },
      data: { status: 'PROCESSING', fencingToken, lockedUntil },
    });
    return claimed.count === 1 ? { idempotencyKey: `refund:${paymentId}`, fencingToken } : null;
  }

  async completeRefund(paymentId: string, fencingToken: string): Promise<void> {
    await this.prisma.refundOperation.updateMany({
      where: { paymentId, fencingToken, status: 'PROCESSING' },
      data: { status: 'COMPLETED', lockedUntil: null },
    });
  }

  async refundCompleted(paymentId: string): Promise<boolean> {
    const operation = await this.prisma.refundOperation.findUnique({ where: { paymentId } });
    return operation?.status === 'COMPLETED';
  }

  async completeSaga(ordemServicoId: string, eventId: string, compensacoes: string[]): Promise<boolean> {
    try {
      await this.prisma.sagaCompletion.create({
        data: { ordemServicoId, eventId, compensacoes },
      });
      return true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;

      const [sameEvent, sameOrder] = await Promise.all([
        this.prisma.sagaCompletion.findUnique({ where: { eventId } }),
        this.prisma.sagaCompletion.findUnique({ where: { ordemServicoId } }),
      ]);
      if (sameEvent?.ordemServicoId === ordemServicoId) return sameEvent.publishedAt === null;
      if (sameOrder) return false;
      throw error;
    }
  }

  async markSagaPublished(eventId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.sagaCompletion.update({ where: { eventId }, data: { publishedAt: new Date() } }),
      this.prisma.sagaEventReceipt.updateMany({ where: { eventId }, data: { status: 'COMPLETED' } }),
    ]);
  }
}
