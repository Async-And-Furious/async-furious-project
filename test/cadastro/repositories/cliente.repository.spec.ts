import { NotFoundException } from '@nestjs/common';
import { ClienteRepository } from '../../../src/modules/cadastro/infrastructure/repositories/cliente.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

describe('ClienteRepository', () => {
  const cliente = {
    id: 'cli-1',
    nome: 'Ana',
    email: 'ana@example.com',
    telefone: null,
    documento: '15350946056',
    tipo_documento: 'CPF' as const,
    ativo: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
  let prisma: {
    cliente: {
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };
  let project: jest.Mock;
  let repository: ClienteRepository;

  beforeEach(() => {
    prisma = {
      cliente: {
        findFirst: jest.fn().mockResolvedValue(cliente),
        update: jest.fn().mockResolvedValue({ ...cliente, ativo: false }),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    project = jest.fn();
    repository = new ClienteRepository(prisma as unknown as PrismaService, { project });
  });

  it('returns null when no active customer has the given document', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);

    await expect(repository.findByDocumento('00000000000')).resolves.toBeNull();
    expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
      where: { documento: '00000000000', ativo: true },
      include: { veiculos: true },
    });
  });

  describe('remove (#378, item 2)', () => {
    it('faz soft delete: marca ativo=false, não apaga a linha e reprojeta o read model', async () => {
      await repository.remove('cli-1');

      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 'cli-1' },
        data: { ativo: false },
      });
      expect(prisma.cliente.delete).not.toHaveBeenCalled();
      expect(project).toHaveBeenCalledWith('cli-1');
    });

    it('cliente já removido responde 404', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);

      await expect(repository.remove('cli-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });
  });

  it('as leituras do cadastro ignoram cliente inativo', async () => {
    await repository.findById('cli-1');
    await repository.findAll(1, 10, 'Ana');

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cli-1', ativo: true } })
    );
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ativo: true }) })
    );
  });
});
