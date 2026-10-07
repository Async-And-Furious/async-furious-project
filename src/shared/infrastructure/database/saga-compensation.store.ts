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
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      const claimed = await this.prisma.sagaEventReceipt.updateMany({
        where: { eventId, status: { not: 'COMPLETED' }, lockedUntil: { lt: new Date() } },
        data: { status: 'PROCESSING', lockedUntil },
      });
      return claimed.count === 1;
    }
  }

  async recordEvidence(eventId: string, evidence: string): Promise<void> {
    await this.prisma.sagaEventReceipt.update({
      where: { eventId },
      data: { status: 'PENDING', evidence },
    });
  }

  async markSagaPublicationFailed(eventId: string, error: string): Promise<void> {
    const completion = await this.prisma.sagaCompletion.findUnique({ where: { eventId } });
    const attempts = completion?.attempts ?? 0;
    const delay = Math.min(300_000, 1_000 * 2 ** Math.min(attempts, 8));
    await this.prisma.sagaEventReceipt.update({
      where: { eventId },
      data: { status: 'FAILED', evidence: error },
    });
    await this.prisma.sagaCompletion.updateMany({
      where: { eventId },
      data: { status: 'FAILED', lastError: error, nextAttemptAt: new Date(Date.now() + delay), lockedUntil: null },
    });
  }

  async claimRefund(
    paymentId: string,
    amount: number
  ): Promise<{ idempotencyKey: string; fencingToken: string } | null> {
    const now = new Date();
    const fencingToken = randomUUID();
    const lockedUntil = new Date(Date.now() + 60_000);
    const result = await this.prisma.refundOperation.createMany({
      data: {
        paymentId,
        idempotencyKey: `refund:${paymentId}`,
        amount,
        status: 'PROCESSING',
        fencingToken,
        lockedUntil,
      },
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

  async completeSaga(
    ordemServicoId: string,
    eventId: string,
    compensacoes: string[]
  ): Promise<boolean> {
    try {
      await this.prisma.sagaCompletion.create({
        data: { ordemServicoId, eventId, compensacoes, status: 'OUTBOX' },
      });
      return true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;

      const [sameEvent, sameOrder] = await Promise.all([
        this.prisma.sagaCompletion.findUnique({ where: { eventId } }),
        this.prisma.sagaCompletion.findUnique({ where: { ordemServicoId } }),
      ]);
      if (sameEvent?.ordemServicoId === ordemServicoId) return sameEvent.status !== 'COMPLETED';
      if (sameOrder) return false;
      throw error;
    }
  }

  async markSagaPublished(eventId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.sagaCompletion.update({
        where: { eventId },
        data: { status: 'COMPLETED', publishedAt: new Date(), lockedUntil: null },
      }),
      this.prisma.sagaEventReceipt.updateMany({
        where: { eventId },
        data: { status: 'COMPLETED' },
      }),
    ]);
  }

  async claimSagaForPublication(): Promise<{
    eventId: string;
    ordemServicoId: string;
    compensacoes: string[];
    attempts: number;
  } | null> {
    const now = new Date();
    const lockedUntil = new Date(Date.now() + 60_000);
    const candidate = await this.prisma.sagaCompletion.findFirst({
      where: {
        status: { in: ['OUTBOX', 'FAILED'] },
        nextAttemptAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.sagaCompletion.updateMany({
      where: {
        eventId: candidate.eventId,
        status: { in: ['OUTBOX', 'FAILED'] },
        nextAttemptAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      data: { status: 'PROCESSING', lockedUntil, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return null;
    return {
      eventId: candidate.eventId,
      ordemServicoId: candidate.ordemServicoId,
      compensacoes: Array.isArray(candidate.compensacoes) ? candidate.compensacoes.map(String) : [],
      attempts: candidate.attempts + 1,
    };
  }
}
