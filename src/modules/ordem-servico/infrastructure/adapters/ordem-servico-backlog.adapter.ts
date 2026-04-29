import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import type {
  IOrdemServicoBacklogPort,
  OrdemServicoBacklogItem,
} from '@/shared/domain/interfaces/ordem-servico-backlog.port';

@Injectable()
export class OrdemServicoBacklogAdapter implements IOrdemServicoBacklogPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAguardandoPecas(): Promise<OrdemServicoBacklogItem[]> {
    const ordens = await this.prisma.ordemServico.findMany({
      where: { status: 'AWAITING_PARTS' },
      include: {
        osPecas: true,
      },
    });

    return ordens.map((os) => ({
      ordemId: os.id,
      pecas: os.osPecas.map((p) => ({
        pecaId: p.id_peca,
        quantidadeNecessaria: p.quantidade,
      })),
    }));
  }
}
