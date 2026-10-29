import { OsReadModelProjector } from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.projector';
import type { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import type { ReadModelFailureReporter } from '../../src/shared/infrastructure/read-model/read-model-failure.reporter';
import type { Db } from 'mongodb';

const linhaOs = {
  id: 'os-1',
  id_veiculo: 'vei-1',
  id_cliente: 'cli-1',
  status: 'IN_PROGRESS',
  descricao: 'Troca de óleo',
  iniciada_em: new Date('2026-01-02T10:00:00Z'),
  finalizada_em: null,
  entregue_em: null,
  created_at: new Date('2026-01-01T09:00:00Z'),
  updated_at: new Date('2026-01-02T10:00:00Z'),
  cliente: { id: 'cli-1', nome: 'Maria', documento: '52998224725' },
  veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
};

describe('OsReadModelProjector', () => {
  let prisma: { ordemServico: { findUnique: jest.Mock } };
  let collection: { replaceOne: jest.Mock; deleteOne: jest.Mock };
  let reporter: { report: jest.Mock };
  let projector: OsReadModelProjector;

  beforeEach(() => {
    prisma = { ordemServico: { findUnique: jest.fn().mockResolvedValue(linhaOs) } };
    collection = {
      replaceOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    reporter = { report: jest.fn() };
    const db = { collection: jest.fn(() => collection) };
    projector = new OsReadModelProjector(
      prisma as unknown as PrismaService,
      db as unknown as Db,
      reporter as unknown as ReadModelFailureReporter
    );
  });

  it('relê o agregado no Postgres e substitui o documento inteiro com upsert', async () => {
    await projector.project('os-1');

    expect(prisma.ordemServico.findUnique).toHaveBeenCalledWith({
      where: { id: 'os-1' },
      include: {
        cliente: { select: { id: true, nome: true, documento: true } },
        veiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
      },
    });
    expect(collection.replaceOne).toHaveBeenCalledWith(
      { _id: 'os-1' },
      {
        _id: 'os-1',
        status: 'IN_PROGRESS',
        descricao: 'Troca de óleo',
        prioridade: 1,
        createdAt: linhaOs.created_at,
        updatedAt: linhaOs.updated_at,
        marcos: {
          createdAt: linhaOs.created_at,
          iniciadaEm: linhaOs.iniciada_em,
          finalizadaEm: null,
          entregueEm: null,
        },
        cliente: { id: 'cli-1', nome: 'Maria', documento: '52998224725' },
        veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
      },
      { upsert: true }
    );
  });

  it('não leva orçamento, itens nem histórico para o documento', async () => {
    prisma.ordemServico.findUnique.mockResolvedValue({
      ...linhaOs,
      orcamento: { id: 'orc-1' },
      osPecas: [{ id: 'p' }],
      historicoStatus: [{ id: 'h' }],
    });

    await projector.project('os-1');

    const doc = collection.replaceOne.mock.calls[0][1] as Record<string, unknown>;
    expect(doc).not.toHaveProperty('orcamento');
    expect(doc).not.toHaveProperty('osPecas');
    expect(doc).not.toHaveProperty('historicoStatus');
  });

  it('remove o documento quando a OS não existe mais no Postgres', async () => {
    prisma.ordemServico.findUnique.mockResolvedValue(null);

    await projector.project('os-1');

    expect(collection.deleteOne).toHaveBeenCalledWith({ _id: 'os-1' });
    expect(collection.replaceOne).not.toHaveBeenCalled();
  });

  it('DocumentDB negando a escrita não derruba o request: relata e segue', async () => {
    const falha = new Error('not authorized on os_read_model');
    collection.replaceOne.mockRejectedValue(falha);

    await expect(projector.project('os-1')).resolves.toBeUndefined();
    expect(reporter.report).toHaveBeenCalledWith('os_read_model', 'os-1', falha);
  });
});
