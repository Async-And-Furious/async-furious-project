import { PecaInsumoRepository } from '../../../src/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { PedidoFornecedorRepository } from '../../../src/modules/pecas-insumos/infrastructure/repositories/pedido-fornecedor.repository';
import type { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

// #378, item 9: débito e recebimento de estoque atômicos, condicionados no UPDATE.
describe('PecaInsumoRepository.debitarEstoqueAtomico', () => {
  let tx: { peca: { updateMany: jest.Mock } };
  let prisma: { $transaction: jest.Mock };
  let repository: PecaInsumoRepository;
  let commits: number;

  beforeEach(() => {
    commits = 0;
    tx = { peca: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
        const result = await fn(tx);
        commits += 1;
        return result;
      }),
    };
    repository = new PecaInsumoRepository(prisma as unknown as PrismaService);
  });

  it('decrementa cada item só se houver saldo, numa transação', async () => {
    const result = await repository.debitarEstoqueAtomico([
      { id_peca: 'peca-1', quantidade: 3 },
      { id_peca: 'peca-2', quantidade: 1 },
    ]);

    expect(tx.peca.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'peca-1', quantidade_estoque: { gte: 3 } },
      data: { quantidade_estoque: { decrement: 3 } },
    });
    expect(tx.peca.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'peca-2', quantidade_estoque: { gte: 1 } },
      data: { quantidade_estoque: { decrement: 1 } },
    });
    expect(result).toEqual({ indisponiveis: [] });
    expect(commits).toBe(1);
  });

  it('com o segundo item sem saldo, desfaz a transação e devolve os ids indisponíveis', async () => {
    tx.peca.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const result = await repository.debitarEstoqueAtomico([
      { id_peca: 'peca-1', quantidade: 3 },
      { id_peca: 'peca-2', quantidade: 9 },
    ]);

    expect(result).toEqual({ indisponiveis: ['peca-2'] });
    expect(commits).toBe(0); // a transação lançou: o débito da peca-1 não é confirmado
  });

  it('propaga erros que não são de saldo', async () => {
    const falha = new Error('deadlock detected');
    tx.peca.updateMany.mockRejectedValue(falha);

    await expect(
      repository.debitarEstoqueAtomico([{ id_peca: 'peca-1', quantidade: 1 }])
    ).rejects.toBe(falha);
  });
});

describe('PedidoFornecedorRepository.receberECreditarEstoque', () => {
  let tx: {
    pedidoFornecedor: { updateMany: jest.Mock };
    pedidoFornecedorItem: { findMany: jest.Mock; update: jest.Mock };
    peca: { update: jest.Mock };
  };
  let repository: PedidoFornecedorRepository;

  beforeEach(() => {
    tx = {
      pedidoFornecedor: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      pedidoFornecedorItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'item-1', id_peca: 'peca-1', quantidade_solicitada: 5 },
          { id: 'item-2', id_peca: 'peca-2', quantidade_solicitada: 2 },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      peca: {
        update: jest
          .fn()
          .mockResolvedValueOnce({ quantidade_estoque: 15 })
          .mockResolvedValueOnce({ quantidade_estoque: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    repository = new PedidoFornecedorRepository(prisma as unknown as PrismaService);
  });

  it('marca RECEBIDO só se PENDENTE e incrementa o estoque de cada item', async () => {
    const result = await repository.receberECreditarEstoque('pedido-1');

    expect(tx.pedidoFornecedor.updateMany).toHaveBeenCalledWith({
      where: { id: 'pedido-1', status: 'PENDENTE' },
      data: { status: 'RECEBIDO', atualizado_em: expect.any(Date) },
    });
    expect(tx.peca.update).toHaveBeenCalledWith({
      where: { id: 'peca-1' },
      data: { quantidade_estoque: { increment: 5 } },
      select: { quantidade_estoque: true },
    });
    expect(tx.pedidoFornecedorItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantidade_recebida: 5 },
    });
    expect(result).toEqual([
      { pecaId: 'peca-1', novaQuantidade: 15 },
      { pecaId: 'peca-2', novaQuantidade: 2 },
    ]);
  });

  it('não credita nada quando o pedido já foi recebido (segunda chamada ou concorrente)', async () => {
    tx.pedidoFornecedor.updateMany.mockResolvedValue({ count: 0 });

    const result = await repository.receberECreditarEstoque('pedido-1');

    expect(result).toBeNull();
    expect(tx.peca.update).not.toHaveBeenCalled();
  });
});
