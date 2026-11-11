import { OrdemServicoRepository } from '@/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository';
import { EntityNotFoundException } from '@/shared/domain/exceptions/entity-not-found.exception';
import type { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import type { IOsReadModelProjector } from '@/modules/ordem-servico/domain/interfaces/os-read-model.interface';

// O repository é o ponto único de escrita da OS: cada método de escrita grava
// no Postgres (com HistoricoStatusOS quando o status muda) e depois projeta.
describe('OrdemServicoRepository', () => {
  const registro = {
    id: 'os-123',
    id_veiculo: 'veiculo-123',
    id_cliente: 'cliente-123',
    descricao: 'Troca de óleo',
    status: 'RECEIVED',
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    reserva_pecas_pendente: false,
    pago_em: null,
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
  };

  let tx: {
    $queryRaw: jest.Mock;
    ordemServico: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    historicoStatusOS: { create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    ordemServico: { findUnique: jest.Mock; findMany: jest.Mock; delete: jest.Mock };
  };
  let projector: jest.Mocked<IOsReadModelProjector>;
  let repository: OrdemServicoRepository;
  let ordem: string[];

  beforeEach(() => {
    ordem = [];
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ status: 'RECEIVED' }]),
      ordemServico: {
        create: jest.fn().mockResolvedValue(registro),
        update: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...registro, ...args.data })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      historicoStatusOS: {
        create: jest.fn(() => {
          ordem.push('historico');
          return Promise.resolve({});
        }),
      },
    };
    prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
        const result = await fn(tx);
        ordem.push('commit');
        return result;
      }),
      ordemServico: {
        findUnique: jest.fn().mockResolvedValue(registro),
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue(registro),
      },
    };
    projector = {
      project: jest.fn((_id: string) => {
        ordem.push('projecao');
        return Promise.resolve();
      }),
    };
    repository = new OrdemServicoRepository(prisma as unknown as PrismaService, projector);
  });

  describe('create', () => {
    it('grava a OS e o histórico RECEIVED na transação e projeta depois do commit', async () => {
      const result = await repository.create({
        veiculoId: 'veiculo-123',
        clienteId: 'cliente-123',
        descricao: 'Troca de óleo',
      });

      expect(tx.ordemServico.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_veiculo: 'veiculo-123',
          id_cliente: 'cliente-123',
          descricao: 'Troca de óleo',
          status: 'RECEIVED',
        }),
      });
      expect(tx.historicoStatusOS.create).toHaveBeenCalledWith({
        data: { ordem_servico_id: 'os-123', status_novo: 'RECEIVED' },
      });
      expect(projector.project).toHaveBeenCalledWith('os-123');
      expect(ordem).toEqual(['historico', 'commit', 'projecao']);
      expect(result).toEqual(expect.objectContaining({ id: 'os-123', clienteId: 'cliente-123' }));
    });
  });

  describe('update', () => {
    it('grava histórico com status anterior e motivo quando o status muda, e projeta', async () => {
      await repository.update('os-123', {
        status: 'CLOSED_WITHOUT_EXECUTION',
        motivo: 'Orçamento recusado pelo cliente',
      });

      // lê o status atual com lock de linha dentro da transação
      const [sql, id] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, string];
      expect(sql.join('?')).toMatch(/SELECT status FROM "OrdemServico" WHERE id = \? FOR UPDATE/);
      expect(id).toBe('os-123');
      expect(tx.ordemServico.update).toHaveBeenCalledWith({
        where: { id: 'os-123' },
        data: { status: 'CLOSED_WITHOUT_EXECUTION' },
      });
      expect(tx.historicoStatusOS.create).toHaveBeenCalledWith({
        data: {
          ordem_servico_id: 'os-123',
          status_anterior: 'RECEIVED',
          status_novo: 'CLOSED_WITHOUT_EXECUTION',
          motivo: 'Orçamento recusado pelo cliente',
        },
      });
      expect(ordem).toEqual(['historico', 'commit', 'projecao']);
    });

    it('não grava histórico quando o status não muda', async () => {
      await repository.update('os-123', { status: 'RECEIVED' });

      expect(tx.historicoStatusOS.create).not.toHaveBeenCalled();
      expect(projector.project).toHaveBeenCalledWith('os-123');
    });

    it('projeta marcos de tempo sem histórico (escrita sem status)', async () => {
      const iniciada = new Date('2024-01-16T10:00:00Z');

      const result = await repository.update('os-123', { iniciada_em: iniciada });

      expect(tx.ordemServico.update).toHaveBeenCalledWith({
        where: { id: 'os-123' },
        data: { iniciada_em: iniciada },
      });
      expect(tx.historicoStatusOS.create).not.toHaveBeenCalled();
      expect(projector.project).toHaveBeenCalledWith('os-123');
      expect(result.iniciada_em).toEqual(iniciada);
    });

    it('repassa todos os campos informados para o Postgres', async () => {
      const data = {
        descricao: 'Nova descrição',
        finalizada_em: new Date('2024-01-17'),
        entregue_em: null,
      };

      await repository.update('os-123', data);

      expect(tx.ordemServico.update).toHaveBeenCalledWith({ where: { id: 'os-123' }, data });
    });

    it('lança EntityNotFoundException e não projeta quando a OS não existe', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(repository.update('x', { status: 'UNDER_DIAGNOSIS' })).rejects.toThrow(
        EntityNotFoundException
      );
      expect(tx.ordemServico.update).not.toHaveBeenCalled();
      expect(projector.project).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('remove a OS e projeta (o projetor apaga o documento)', async () => {
      const result = await repository.remove('os-123');

      expect(prisma.ordemServico.delete).toHaveBeenCalledWith({ where: { id: 'os-123' } });
      expect(projector.project).toHaveBeenCalledWith('os-123');
      expect(result.id).toBe('os-123');
    });

    it('lança EntityNotFoundException quando a OS não existe', async () => {
      prisma.ordemServico.findUnique.mockResolvedValue(null);

      await expect(repository.remove('x')).rejects.toThrow(EntityNotFoundException);
      expect(projector.project).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lê do Postgres (leitura interna de casos de uso de escrita)', async () => {
      const result = await repository.findOne('os-123');

      expect(prisma.ordemServico.findUnique).toHaveBeenCalledWith({
        where: { id: 'os-123' },
        include: { veiculo: true, cliente: true },
      });
      expect(result).toEqual(expect.objectContaining({ id: 'os-123', veiculoId: 'veiculo-123' }));
    });

    it('lança EntityNotFoundException quando a OS não existe', async () => {
      prisma.ordemServico.findUnique.mockResolvedValue(null);

      await expect(repository.findOne('x')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('calcularTempoMedioExecucao', () => {
    it('calcula a média com múltiplas ordens', async () => {
      const inicio = new Date('2024-01-01T08:00:00Z');
      prisma.ordemServico.findMany.mockResolvedValue([
        { iniciada_em: inicio, finalizada_em: new Date('2024-01-01T10:00:00Z') },
        { iniciada_em: inicio, finalizada_em: new Date('2024-01-01T09:00:00Z') },
      ]);

      const result = await repository.calcularTempoMedioExecucao();

      expect(prisma.ordemServico.findMany).toHaveBeenCalledWith({
        where: { status: 'DELIVERED', iniciada_em: { not: null }, finalizada_em: { not: null } },
        select: { iniciada_em: true, finalizada_em: true },
      });
      expect(result).toEqual({ totalMinutos: 180, total: 2 });
    });

    it('retorna zero quando não há ordens entregues', async () => {
      prisma.ordemServico.findMany.mockResolvedValue([]);

      await expect(repository.calcularTempoMedioExecucao()).resolves.toEqual({
        totalMinutos: 0,
        total: 0,
      });
    });
  });

  describe('atualizarSeCondicao', () => {
    it('grava com a condição no where, registra o histórico com motivo e projeta depois do commit', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: 'AWAITING_APPROVAL' }]);

      const gravou = await repository.atualizarSeCondicao(
        'os-123',
        { status: 'AWAITING_APPROVAL', pago_em: null },
        { status: 'CLOSED_WITHOUT_EXECUTION', motivo: 'OS parada' }
      );

      expect(gravou).toBe(true);
      expect(tx.ordemServico.updateMany).toHaveBeenCalledWith({
        where: { id: 'os-123', status: 'AWAITING_APPROVAL', pago_em: null },
        data: { status: 'CLOSED_WITHOUT_EXECUTION' },
      });
      expect(tx.historicoStatusOS.create).toHaveBeenCalledWith({
        data: {
          ordem_servico_id: 'os-123',
          status_anterior: 'AWAITING_APPROVAL',
          status_novo: 'CLOSED_WITHOUT_EXECUTION',
          motivo: 'OS parada',
        },
      });
      expect(ordem).toEqual(['historico', 'commit', 'projecao']);
    });

    it('não grava histórico nem projeta quando a condição não casa', async () => {
      tx.ordemServico.updateMany.mockResolvedValue({ count: 0 });

      const gravou = await repository.atualizarSeCondicao(
        'os-123',
        { status: 'IN_PROGRESS' },
        { status: 'FINISHED' }
      );

      expect(gravou).toBe(false);
      expect(tx.historicoStatusOS.create).not.toHaveBeenCalled();
      expect(projector.project).not.toHaveBeenCalled();
    });

    it('sem mudança de status (só flags) não grava histórico, mas projeta', async () => {
      const gravou = await repository.atualizarSeCondicao(
        'os-123',
        { reserva_pecas_pendente: true },
        { reserva_pecas_pendente: false }
      );

      expect(gravou).toBe(true);
      expect(tx.ordemServico.updateMany).toHaveBeenCalledWith({
        where: { id: 'os-123', reserva_pecas_pendente: true },
        data: { reserva_pecas_pendente: false },
      });
      expect(tx.historicoStatusOS.create).not.toHaveBeenCalled();
      expect(projector.project).toHaveBeenCalledWith('os-123');
    });

    it('devolve false sem gravar quando a OS não existe', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(
        repository.atualizarSeCondicao('x', { status: 'RECEIVED' }, { status: 'UNDER_DIAGNOSIS' })
      ).resolves.toBe(false);
      expect(tx.ordemServico.updateMany).not.toHaveBeenCalled();
      expect(projector.project).not.toHaveBeenCalled();
    });
  });

  describe('findParadasAguardandoAprovacao', () => {
    it('busca OS em AWAITING_APPROVAL sem pagamento e sem atualização desde o limite', async () => {
      const limite = new Date('2026-01-01T00:00:00Z');
      prisma.ordemServico.findMany.mockResolvedValue([
        { ...registro, status: 'AWAITING_APPROVAL' },
      ]);

      const result = await repository.findParadasAguardandoAprovacao(limite);

      expect(prisma.ordemServico.findMany).toHaveBeenCalledWith({
        where: { status: 'AWAITING_APPROVAL', pago_em: null, updated_at: { lt: limite } },
        orderBy: { updated_at: 'asc' },
      });
      expect(result[0].status).toBe('AWAITING_APPROVAL');
    });
  });

  it('update grava o marcador de reserva de peças pendente', async () => {
    const result = await repository.update('os-123', { reserva_pecas_pendente: true });

    expect(tx.ordemServico.update).toHaveBeenCalledWith({
      where: { id: 'os-123' },
      data: { reserva_pecas_pendente: true },
    });
    expect(result.reservaPecasPendente).toBe(true);
  });
});
