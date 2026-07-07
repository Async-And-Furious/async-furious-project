import { PrismaClient } from '@prisma/client';
import { IStatusHistoryRepository } from '../../domain/interfaces/status-history.interface';
import { HistoricoStatus } from '../../domain/entities/historico-status.entity';
import { OSStatus } from '../../domain/entities/ordem-servico.entity';

export class StatusHistoryRepository implements IStatusHistoryRepository {
  private prisma = new PrismaClient();

  async create(historico: HistoricoStatus): Promise<HistoricoStatus> {
    const created = await this.prisma.historicoStatusOS.create({
      data: {
        ordem_servico_id: historico.ordemServicoId,
        status_anterior: historico.statusAnterior,
        status_novo: historico.statusNovo,
        motivo: historico.motivo,
        data_hora: historico.dataHora,
      },
    });

    return HistoricoStatus.create({
      id: created.id,
      ordemServicoId: created.ordem_servico_id,
      statusAnterior: created.status_anterior as OSStatus | null,
      statusNovo: created.status_novo as OSStatus,
      motivo: created.motivo,
      dataHora: created.data_hora,
    });
  }

  async findByOrdemServicoId(ordemServicoId: string): Promise<HistoricoStatus[]> {
    const historicos = await this.prisma.historicoStatusOS.findMany({
      where: { ordem_servico_id: ordemServicoId },
      orderBy: { data_hora: 'asc' },
    });

    return historicos.map((h) =>
      HistoricoStatus.create({
        id: h.id,
        ordemServicoId: h.ordem_servico_id,
        statusAnterior: h.status_anterior as OSStatus | null,
        statusNovo: h.status_novo as OSStatus,
        motivo: h.motivo,
        dataHora: h.data_hora,
      })
    );
  }
}
