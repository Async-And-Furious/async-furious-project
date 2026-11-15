import { StatusHistoryRepository } from '../../../src/modules/ordem-servico/infrastructure/repositories/status-history.repository';
import { HistoricoStatus } from '../../../src/modules/ordem-servico/domain/entities/historico-status.entity';
import type { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

// #335: usa o PrismaService injetado, não um PrismaClient próprio.
describe('StatusHistoryRepository', () => {
  const dataHora = new Date('2026-11-11T12:00:00.000Z');
  const linha = {
    id: 'h-1',
    ordem_servico_id: 'os-1',
    status_anterior: 'AWAITING_APPROVAL',
    status_novo: 'AWAITING_APPROVAL',
    motivo: 'Pagamento confirmado',
    data_hora: dataHora,
  };
  let prisma: { historicoStatusOS: { create: jest.Mock; findMany: jest.Mock } };
  let repository: StatusHistoryRepository;

  beforeEach(() => {
    prisma = {
      historicoStatusOS: {
        create: jest.fn().mockResolvedValue(linha),
        findMany: jest.fn().mockResolvedValue([linha]),
      },
    };
    repository = new StatusHistoryRepository(prisma as unknown as PrismaService);
  });

  it('grava a linha de histórico pelo PrismaService e devolve a entidade', async () => {
    const criado = await repository.create(
      HistoricoStatus.create({
        ordemServicoId: 'os-1',
        statusAnterior: 'AWAITING_APPROVAL',
        statusNovo: 'AWAITING_APPROVAL',
        motivo: 'Pagamento confirmado',
        dataHora,
      })
    );

    expect(prisma.historicoStatusOS.create).toHaveBeenCalledWith({
      data: {
        ordem_servico_id: 'os-1',
        status_anterior: 'AWAITING_APPROVAL',
        status_novo: 'AWAITING_APPROVAL',
        motivo: 'Pagamento confirmado',
        data_hora: dataHora,
      },
    });
    expect(criado).toMatchObject({ id: 'h-1', ordemServicoId: 'os-1', motivo: linha.motivo });
  });

  it('lista o histórico da OS em ordem cronológica', async () => {
    const historico = await repository.findByOrdemServicoId('os-1');

    expect(prisma.historicoStatusOS.findMany).toHaveBeenCalledWith({
      where: { ordem_servico_id: 'os-1' },
      orderBy: { data_hora: 'asc' },
    });
    expect(historico).toHaveLength(1);
    expect(historico[0]).toBeInstanceOf(HistoricoStatus);
  });
});
