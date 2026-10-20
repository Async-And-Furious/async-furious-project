import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PagamentoRepository } from '../../../src/modules/financeiro/infrastructure/repositories/pagamento.repository';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import { Pagamento } from '../../../src/modules/financeiro/domain/entities/pagamento.entity';

interface MockPrismaPagamento {
  upsert: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  deleteMany: jest.Mock;
}

interface MockPrismaService {
  pagamento: MockPrismaPagamento;
  webhookRecebido: { create: jest.Mock };
  $transaction: jest.Mock;
}

const erroUnicidade = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('PagamentoRepository', () => {
  let repository: PagamentoRepository;
  let mockPrismaService: MockPrismaService;

  const mockPagamentoData = {
    id: 'pag-123',
    ordemServicoId: 'os-123',
    valor: 100.0,
    status: 'AGUARDANDO_PAGAMENTO',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      pagamento: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      webhookRecebido: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    // A transação interativa recebe o próprio mock como "tx".
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: MockPrismaService) => Promise<unknown>) => fn(mockPrismaService)
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagamentoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<PagamentoRepository>(PagamentoRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('should upsert pagamento', async () => {
      const pagamento = Pagamento.criar('os-123', 100);

      await repository.save(pagamento as unknown as Pagamento);

      expect(mockPrismaService.pagamento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: expect.any(String) }),
          create: expect.any(Object),
          update: expect.any(Object),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return pagamento when found', async () => {
      mockPrismaService.pagamento.findUnique.mockResolvedValue(mockPagamentoData);

      const result = await repository.findById('pag-123');

      expect(result).toBeDefined();
      expect(mockPrismaService.pagamento.findUnique).toHaveBeenCalledWith({
        where: { id: 'pag-123' },
      });
    });

    it('should return null when not found', async () => {
      mockPrismaService.pagamento.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
      expect(mockPrismaService.pagamento.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      });
    });
  });

  describe('findByOrdemServicoId', () => {
    it('should look the pagamento up by its unique ordemServicoId', async () => {
      mockPrismaService.pagamento.findUnique.mockResolvedValue({
        ...mockPagamentoData,
        preferenceId: 'pref-1',
        linkPagamento: 'https://mp.test/checkout/pref-1',
        mercadoPagoPaymentId: null,
      });

      const result = await repository.findByOrdemServicoId('os-123');

      expect(result?.getLinkPagamento()).toBe('https://mp.test/checkout/pref-1');
      expect(mockPrismaService.pagamento.findUnique).toHaveBeenCalledWith({
        where: { ordemServicoId: 'os-123' },
      });
    });

    it('should return null when the OS has no pagamento', async () => {
      mockPrismaService.pagamento.findUnique.mockResolvedValue(null);

      await expect(repository.findByOrdemServicoId('os-123')).resolves.toBeNull();
    });
  });

  describe('reservar', () => {
    it('should insert the pagamento and return true', async () => {
      await expect(repository.reservar(Pagamento.criar('os-123', 100))).resolves.toBe(true);
      expect(mockPrismaService.pagamento.create).toHaveBeenCalled();
    });

    it('should return false when the OS already has a pagamento (unique violation)', async () => {
      mockPrismaService.pagamento.create.mockRejectedValue(erroUnicidade());

      await expect(repository.reservar(Pagamento.criar('os-123', 100))).resolves.toBe(false);
    });

    it('should rethrow other errors', async () => {
      mockPrismaService.pagamento.create.mockRejectedValue(new Error('db down'));

      await expect(repository.reservar(Pagamento.criar('os-123', 100))).rejects.toThrow('db down');
    });
  });

  describe('remover', () => {
    it('should delete the pagamento by id', async () => {
      await repository.remover('pag-1');

      expect(mockPrismaService.pagamento.deleteMany).toHaveBeenCalledWith({
        where: { id: 'pag-1' },
      });
    });
  });

  describe('saveComNotificacao', () => {
    const notificacao = { providerEventId: 'mp-1', tipo: 'payment.approved' };

    it('should record the notification and update the pagamento in the same transaction', async () => {
      const pagamento = Pagamento.criar('os-123', 100);
      pagamento.confirmar('mp-1');

      await expect(repository.saveComNotificacao(pagamento, notificacao)).resolves.toBe(true);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.webhookRecebido.create).toHaveBeenCalledWith({
        data: { providerEventId: 'mp-1', tipo: 'payment.approved' },
      });
      expect(mockPrismaService.pagamento.update).toHaveBeenCalledWith({
        where: { id: pagamento.getId() },
        data: { status: 'CONFIRMADO', mercadoPagoPaymentId: 'mp-1' },
      });
    });

    it('should return false and skip the update when the notification was already processed', async () => {
      mockPrismaService.webhookRecebido.create.mockRejectedValue(erroUnicidade());
      const pagamento = Pagamento.criar('os-123', 100);
      pagamento.confirmar('mp-1');

      await expect(repository.saveComNotificacao(pagamento, notificacao)).resolves.toBe(false);
      expect(mockPrismaService.pagamento.update).not.toHaveBeenCalled();
    });

    it('should propagate a failure in the pagamento update so the transaction rolls back', async () => {
      mockPrismaService.pagamento.update.mockRejectedValue(new Error('db down'));
      const pagamento = Pagamento.criar('os-123', 100);
      pagamento.confirmar('mp-1');

      await expect(repository.saveComNotificacao(pagamento, notificacao)).rejects.toThrow(
        'db down'
      );
    });
  });
});
