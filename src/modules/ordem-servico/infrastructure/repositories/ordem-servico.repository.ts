import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { OrdemDeServico } from '../../domain/entities/ordem-servico.entity';
import {
  IOrdemServicoRepository,
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
    created_at: Date;
    updated_at: Date;
    orcamento?: unknown;
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
    entity.created_at = record.created_at;
    entity.updated_at = record.updated_at;
    if (record.orcamento !== undefined) {
      entity.orcamento = record.orcamento as OrdemDeServico['orcamento'];
    }
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
      include: { veiculo: true, cliente: true, orcamento: true },
    });
    if (!record) throw new EntityNotFoundException('OrdemDeServico', id);
    return this.mapToEntity(record);
  }

  async update(id: string, data: OrdemServicoUpdateData): Promise<OrdemDeServico> {
    const record = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.ordemServico.findUnique({ where: { id }, select: { status: true } });
      if (!atual) throw new EntityNotFoundException('OrdemDeServico', id);

      const updated = await tx.ordemServico.update({
        where: { id },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.descricao !== undefined && { descricao: data.descricao }),
          ...(data.iniciada_em !== undefined && { iniciada_em: data.iniciada_em }),
          ...(data.finalizada_em !== undefined && { finalizada_em: data.finalizada_em }),
          ...(data.entregue_em !== undefined && { entregue_em: data.entregue_em }),
        },
      });

      if (data.status && data.status !== atual.status) {
        await tx.historicoStatusOS.create({
          data: {
            ordem_servico_id: id,
            status_anterior: atual.status,
            status_novo: data.status,
            motivo: data.motivo,
          },
        });
      }
      return updated;
    });
    await this.projector.project(id);
    return this.mapToEntity(record);
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
