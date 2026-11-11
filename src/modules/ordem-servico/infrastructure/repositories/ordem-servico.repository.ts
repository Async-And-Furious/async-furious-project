import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma, SOStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import {
  IOrdemServicoRepository,
  OrdemServicoCondicao,
  OrdemServicoUpdateData,
} from '../../domain/interfaces/ordem-servico.interface';
import { OS_READ_MODEL_PROJECTOR } from '../../domain/interfaces/os-read-model.interface';
import type { IOsReadModelProjector } from '../../domain/interfaces/os-read-model.interface';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/entity-not-found.exception';

// Ponto único de escrita da OS: grava no Postgres (com HistoricoStatusOS
// sempre que o status muda) numa transação e, depois dela, projeta no read
// model (write-through síncrono, ADR-0019).
@Injectable()
export class OrdemServicoRepository implements IOrdemServicoRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OS_READ_MODEL_PROJECTOR) private readonly projector: IOsReadModelProjector
  ) {}

  private mapToEntity(record: {
    id: string;
    id_veiculo: string;
    id_cliente: string;
    status: string;
    descricao: string | null;
    iniciada_em: Date | null;
    finalizada_em: Date | null;
    entregue_em: Date | null;
    reserva_pecas_pendente: boolean;
    pago_em: Date | null;
    created_at: Date;
    updated_at: Date;
    veiculo?: unknown;
    cliente?: unknown;
  }): OrdemDeServico {
    const entity = new OrdemDeServico();
    entity.id = record.id;
    entity.veiculoId = record.id_veiculo;
    entity.clienteId = record.id_cliente;
    entity.status = record.status as OrdemDeServico['status'];
    entity.descricao = record.descricao;
    entity.iniciada_em = record.iniciada_em;
    entity.finalizada_em = record.finalizada_em;
    entity.entregue_em = record.entregue_em;
    entity.reservaPecasPendente = record.reserva_pecas_pendente;
    entity.pago_em = record.pago_em;
    entity.created_at = record.created_at;
    entity.updated_at = record.updated_at;
    return entity;
  }

  async create(data: {
    veiculoId: string;
    clienteId: string;
    descricao?: string;
  }): Promise<OrdemDeServico> {
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ordemServico.create({
        data: {
          id: randomUUID(),
          id_veiculo: data.veiculoId,
          id_cliente: data.clienteId,
          descricao: data.descricao,
          status: 'RECEIVED',
        },
      });
      await tx.historicoStatusOS.create({
        data: { ordem_servico_id: created.id, status_novo: 'RECEIVED' },
      });
      return created;
    });
    await this.projector.project(record.id);
    return this.mapToEntity(record);
  }

  async findOne(id: string): Promise<OrdemDeServico> {
    const record = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: { veiculo: true, cliente: true },
    });
    if (!record) throw new EntityNotFoundException('OrdemDeServico', id);
    return this.mapToEntity(record);
  }

  async update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico> {
    const record = await this.prisma.$transaction(async (tx) => {
      const atual = await this.lerStatusComLock(tx, id);
      if (!atual) throw new EntityNotFoundException('OrdemDeServico', id);

      const updated = await tx.ordemServico.update({
        where: { id },
        data: this.paraDadosPrisma(data),
      });
      await this.registrarHistorico(tx, id, atual, data);
      return updated;
    });
    await this.projector.project(id);
    return this.mapToEntity(record);
  }

  async atualizarSeCondicao(
    id: string,
    condicao: OrdemServicoCondicao,
    data: OrdemServicoUpdateData
  ): Promise<boolean> {
    const gravou = await this.prisma.$transaction(async (tx) => {
      const atual = await this.lerStatusComLock(tx, id);
      if (!atual) return false;

      const { count } = await tx.ordemServico.updateMany({
        where: {
          id,
          ...(condicao.status !== undefined && { status: condicao.status }),
          ...(condicao.reserva_pecas_pendente !== undefined && {
            reserva_pecas_pendente: condicao.reserva_pecas_pendente,
          }),
          ...(condicao.pago_em !== undefined && { pago_em: condicao.pago_em }),
        },
        data: this.paraDadosPrisma(data),
      });
      if (count === 0) return false;

      await this.registrarHistorico(tx, id, atual, data);
      return true;
    });
    if (gravou) await this.projector.project(id);
    return gravou;
  }

  // FOR UPDATE serializa transições concorrentes da mesma OS: sem o lock,
  // duas transações leriam o mesmo status e gravariam dois históricos com o
  // mesmo status_anterior.
  private async lerStatusComLock(
    tx: Prisma.TransactionClient,
    id: string
  ): Promise<{ status: SOStatus } | undefined> {
    const [atual] = await tx.$queryRaw<Array<{ status: SOStatus }>>`
      SELECT status FROM "OrdemServico" WHERE id = ${id} FOR UPDATE
    `;
    return atual;
  }

  // HistoricoStatusOS na mesma transação sempre que a escrita muda o status.
  private async registrarHistorico(
    tx: Prisma.TransactionClient,
    id: string,
    atual: { status: SOStatus },
    data: OrdemServicoUpdateData
  ): Promise<void> {
    if (!data.status || data.status === atual.status) return;
    await tx.historicoStatusOS.create({
      data: {
        ordem_servico_id: id,
        status_anterior: atual.status,
        status_novo: data.status,
        motivo: data.motivo,
      },
    });
  }

  async findParadasAguardandoAprovacao(limite: Date): Promise<OrdemDeServico[]> {
    const records = await this.prisma.ordemServico.findMany({
      where: { status: 'AWAITING_APPROVAL', pago_em: null, updated_at: { lt: limite } },
      orderBy: { updated_at: 'asc' },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  private paraDadosPrisma(data: OrdemServicoUpdateData) {
    return {
      ...(data.status && { status: data.status }),
      ...(data.descricao !== undefined && { descricao: data.descricao }),
      ...(data.iniciada_em !== undefined && { iniciada_em: data.iniciada_em }),
      ...(data.finalizada_em !== undefined && { finalizada_em: data.finalizada_em }),
      ...(data.entregue_em !== undefined && { entregue_em: data.entregue_em }),
      ...(data.reserva_pecas_pendente !== undefined && {
        reserva_pecas_pendente: data.reserva_pecas_pendente,
      }),
      ...(data.pago_em !== undefined && { pago_em: data.pago_em }),
    };
  }

  async remove(id: string): Promise<OrdemDeServico> {
    await this.findOne(id);
    const record = await this.prisma.ordemServico.delete({ where: { id } });
    await this.projector.project(id);
    return this.mapToEntity(record);
  }

  async calcularTempoMedioExecucao(): Promise<{ totalMinutos: number; total: number }> {
    const ordens = await this.prisma.ordemServico.findMany({
      where: {
        status: 'DELIVERED',
        iniciada_em: { not: null },
        finalizada_em: { not: null },
      },
      select: { iniciada_em: true, finalizada_em: true },
    });

    if (ordens.length === 0) return { totalMinutos: 0, total: 0 };

    const totalMinutos = ordens.reduce((acc, os) => {
      const diff = os.finalizada_em!.getTime() - os.iniciada_em!.getTime();
      return acc + diff / 60000;
    }, 0);

    return { totalMinutos, total: ordens.length };
  }
}
