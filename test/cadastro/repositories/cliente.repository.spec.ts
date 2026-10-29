import { ClienteRepository } from '../../../src/modules/cadastro/infrastructure/repositories/cliente.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

describe('ClienteRepository', () => {
  it('returns null when no customer has the given document', async () => {
    const prisma = { cliente: { findUnique: jest.fn().mockResolvedValue(null) } };
    const repository = new ClienteRepository(prisma as unknown as PrismaService, {
      project: jest.fn(),
    });

    await expect(repository.findByDocumento('00000000000')).resolves.toBeNull();
    expect(prisma.cliente.findUnique).toHaveBeenCalledWith({
      where: { documento: '00000000000' },
      include: { veiculos: true },
    });
  });
});
