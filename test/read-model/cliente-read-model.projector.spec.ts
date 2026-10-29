import { ClienteReadModelProjector } from '../../src/modules/cadastro/infrastructure/read-model/cliente-read-model.projector';
import { ClienteReadModelQuery } from '../../src/modules/cadastro/infrastructure/read-model/cliente-read-model.query';
import type { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';
import type { ReadModelFailureReporter } from '../../src/shared/infrastructure/read-model/read-model-failure.reporter';
import type { Db } from 'mongodb';

const linhaCliente = {
  id: 'cli-1',
  nome: 'Maria',
  email: 'maria@example.com',
  telefone: '11999999999',
  documento: '52998224725',
  tipo_documento: 'CPF' as const,
  ativo: true,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('ClienteReadModelProjector', () => {
  let prisma: { cliente: { findUnique: jest.Mock } };
  let collection: { replaceOne: jest.Mock; deleteOne: jest.Mock };
  let reporter: { report: jest.Mock };
  let projector: ClienteReadModelProjector;

  beforeEach(() => {
    prisma = { cliente: { findUnique: jest.fn().mockResolvedValue(linhaCliente) } };
    collection = { replaceOne: jest.fn().mockResolvedValue({}), deleteOne: jest.fn() };
    reporter = { report: jest.fn() };
    projector = new ClienteReadModelProjector(
      prisma as unknown as PrismaService,
      { collection: jest.fn(() => collection) } as unknown as Db,
      reporter as unknown as ReadModelFailureReporter
    );
  });

  it('grava documento plano no formato do ClienteResponseDto', async () => {
    await projector.project('cli-1');

    expect(collection.replaceOne).toHaveBeenCalledWith(
      { _id: 'cli-1' },
      {
        _id: 'cli-1',
        nome: 'Maria',
        email: 'maria@example.com',
        telefone: '11999999999',
        documento: '529.982.247-25',
        tipoDocumento: 'CPF',
      },
      { upsert: true }
    );
  });

  it('remove o documento quando o cliente não existe mais', async () => {
    prisma.cliente.findUnique.mockResolvedValue(null);

    await projector.project('cli-1');

    expect(collection.deleteOne).toHaveBeenCalledWith({ _id: 'cli-1' });
  });

  it('falha no DocumentDB é relatada sem propagar', async () => {
    const falha = new Error('connection refused');
    collection.replaceOne.mockRejectedValue(falha);

    await expect(projector.project('cli-1')).resolves.toBeUndefined();
    expect(reporter.report).toHaveBeenCalledWith('cliente_read_model', 'cli-1', falha);
  });
});

describe('ClienteReadModelQuery', () => {
  it('devolve o documento com id ou null', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ _id: 'cli-1', nome: 'Maria' })
      .mockResolvedValueOnce(null);
    const query = new ClienteReadModelQuery({
      collection: jest.fn(() => ({ findOne })),
    } as unknown as Db);

    await expect(query.findById('cli-1')).resolves.toEqual({ id: 'cli-1', nome: 'Maria' });
    await expect(query.findById('x')).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith({ _id: 'cli-1' });
  });
});
