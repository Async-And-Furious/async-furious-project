import { Test, TestingModule } from '@nestjs/testing';
import { PedidoFornecedorRepository } from '@/modules/pecas-insumos/infrastructure/repositories/pedido-fornecedor.repository';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PedidoFornecedor } from '@/modules/pecas-insumos/domain/entities/pedido-fornecedor.entity';

const BASE_DATE = new Date('2024-01-01');

const MOCK_PRISMA_DATA = {
  id: 'pedido-1',
  fornecedor_id: 'fornecedor-1',
  status: 'PENDENTE',
  criado_em: BASE_DATE,
  atualizado_em: BASE_DATE,
  itens: [
    {
      id: 'item-1',
      id_pedido_fornecedor: 'pedido-1',
      id_peca: 'peca-1',
      quantidade_solicitada: 10,
      quantidade_recebida: 0,
    },
    {
      id: 'item-2',
      id_pedido_fornecedor: 'pedido-1',
      id_peca: 'peca-2',
      quantidade_solicitada: 5,
      quantidade_recebida: 0,
    },
  ],
};

function createMockPrismaService() {
  return {
    pedidoFornecedor: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('PedidoFornecedorRepository', () => {
  let repository: PedidoFornecedorRepository;
  let prismaService: {
    pedidoFornecedor: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidoFornecedorRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<PedidoFornecedorRepository>(PedidoFornecedorRepository);
    prismaService = module.get(PrismaService);
  });

  describe('create', () => {
    it('deve criar um novo pedido para fornecedor com itens', async () => {
      const createData = {
        fornecedor_id: 'fornecedor-1',
        itens: [
          { id_peca: 'peca-1', quantidade_solicitada: 10 },
          { id_peca: 'peca-2', quantidade_solicitada: 5 },
        ],
        status: 'PENDENTE' as const,
        criado_em: new Date('2024-01-01'),
      };

      prismaService.pedidoFornecedor.create.mockResolvedValue(MOCK_PRISMA_DATA);

      const resultado = await repository.create(createData);

      expect(prismaService.pedidoFornecedor.create).toHaveBeenCalledWith({
        data: {
          fornecedor_id: 'fornecedor-1',
          status: 'PENDENTE',
          criado_em: createData.criado_em,
          itens: {
            createMany: {
              data: [
                {
                  id_peca: 'peca-1',
                  quantidade_solicitada: 10,
                  quantidade_recebida: 0,
                },
                {
                  id_peca: 'peca-2',
                  quantidade_solicitada: 5,
                  quantidade_recebida: 0,
                },
              ],
            },
          },
        },
        include: { itens: true },
      });

      expect(resultado).toEqual({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        status: 'PENDENTE',
        criado_em: new Date('2024-01-01'),
        atualizado_em: new Date('2024-01-01'),
        itens: [
          {
            id: 'item-1',
            id_pedido_fornecedor: 'pedido-1',
            id_peca: 'peca-1',
            quantidade_solicitada: 10,
            quantidade_recebida: 0,
          },
          {
            id: 'item-2',
            id_pedido_fornecedor: 'pedido-1',
            id_peca: 'peca-2',
            quantidade_solicitada: 5,
            quantidade_recebida: 0,
          },
        ],
      });
    });

    it('deve criar pedido com um único item', async () => {
      const createData = {
        fornecedor_id: 'fornecedor-1',
        itens: [{ id_peca: 'peca-1', quantidade_solicitada: 15 }],
        status: 'PENDENTE' as const,
        criado_em: new Date('2024-01-01'),
      };

      const mockDataUmItem = {
        ...MOCK_PRISMA_DATA,
        itens: [MOCK_PRISMA_DATA.itens[0]],
      };

      prismaService.pedidoFornecedor.create.mockResolvedValue(mockDataUmItem);

      const resultado = await repository.create(createData);

      expect(prismaService.pedidoFornecedor.create).toHaveBeenCalledWith({
        data: {
          fornecedor_id: 'fornecedor-1',
          status: 'PENDENTE',
          criado_em: createData.criado_em,
          itens: {
            createMany: {
              data: [
                {
                  id_peca: 'peca-1',
                  quantidade_solicitada: 15,
                  quantidade_recebida: 0,
                },
              ],
            },
          },
        },
        include: { itens: true },
      });

      expect(resultado.itens).toHaveLength(1);
      expect(resultado.itens[0].quantidade_solicitada).toBe(10);
    });
  });

  describe('findById', () => {
    it('deve retornar pedido quando encontrado', async () => {
      prismaService.pedidoFornecedor.findUnique.mockResolvedValue(MOCK_PRISMA_DATA);

      const resultado = await repository.findById('pedido-1');

      expect(prismaService.pedidoFornecedor.findUnique).toHaveBeenCalledWith({
        where: { id: 'pedido-1' },
        include: { itens: true },
      });

      expect(resultado).toEqual({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        status: 'PENDENTE',
        criado_em: new Date('2024-01-01'),
        atualizado_em: new Date('2024-01-01'),
        itens: [
          {
            id: 'item-1',
            id_pedido_fornecedor: 'pedido-1',
            id_peca: 'peca-1',
            quantidade_solicitada: 10,
            quantidade_recebida: 0,
          },
          {
            id: 'item-2',
            id_pedido_fornecedor: 'pedido-1',
            id_peca: 'peca-2',
            quantidade_solicitada: 5,
            quantidade_recebida: 0,
          },
        ],
      });
    });

    it('deve retornar null quando pedido não encontrado', async () => {
      prismaService.pedidoFornecedor.findUnique.mockResolvedValue(null);

      const resultado = await repository.findById('pedido-inexistente');

      expect(prismaService.pedidoFornecedor.findUnique).toHaveBeenCalledWith({
        where: { id: 'pedido-inexistente' },
        include: { itens: true },
      });

      expect(resultado).toBeNull();
    });
  });

  describe('save', () => {
    it('deve atualizar pedido existente', async () => {
      const pedidoParaAtualizar: PedidoFornecedor = {
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        status: 'RECEBIDO',
        criado_em: new Date('2024-01-01'),
        atualizado_em: new Date('2024-01-01'),
        itens: [],
      };

      const mockUpdatedData = {
        ...MOCK_PRISMA_DATA,
        status: 'RECEBIDO',
        atualizado_em: new Date('2024-01-02'),
      };

      prismaService.pedidoFornecedor.update.mockResolvedValue(mockUpdatedData);

      const resultado = await repository.save(pedidoParaAtualizar);

      expect(prismaService.pedidoFornecedor.update).toHaveBeenCalledWith({
        where: { id: 'pedido-1' },
        data: {
          status: 'RECEBIDO',
          atualizado_em: expect.any(Date),
        },
        include: { itens: true },
      });

      expect(resultado.status).toBe('RECEBIDO');
      expect(resultado.id).toBe('pedido-1');
    });

    it('deve atualizar status de PENDENTE para RECEBIDO', async () => {
      const pedidoParaAtualizar: PedidoFornecedor = {
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        status: 'RECEBIDO',
        criado_em: new Date('2024-01-01'),
        atualizado_em: new Date('2024-01-01'),
        itens: [],
      };

      const mockUpdatedData = {
        ...MOCK_PRISMA_DATA,
        status: 'RECEBIDO',
      };

      prismaService.pedidoFornecedor.update.mockResolvedValue(mockUpdatedData);

      const resultado = await repository.save(pedidoParaAtualizar);

      expect(resultado.status).toBe('RECEBIDO');
    });
  });

  describe('findAll', () => {
    it('deve retornar todos os pedidos ordenados por data de criação', async () => {
      const mockMultiplosPedidos = [
        MOCK_PRISMA_DATA,
        {
          ...MOCK_PRISMA_DATA,
          id: 'pedido-2',
          criado_em: new Date('2024-01-02'),
        },
      ];

      prismaService.pedidoFornecedor.findMany.mockResolvedValue(mockMultiplosPedidos);

      const resultado = await repository.findAll();

      expect(prismaService.pedidoFornecedor.findMany).toHaveBeenCalledWith({
        include: { itens: true },
        orderBy: { criado_em: 'desc' },
      });

      expect(resultado).toHaveLength(2);
      expect(resultado[0].id).toBe('pedido-1');
      expect(resultado[1].id).toBe('pedido-2');
    });

    it('deve retornar array vazio quando não há pedidos', async () => {
      prismaService.pedidoFornecedor.findMany.mockResolvedValue([]);

      const resultado = await repository.findAll();

      expect(resultado).toEqual([]);
    });

    it('deve retornar pedidos com itens mapeados corretamente', async () => {
      prismaService.pedidoFornecedor.findMany.mockResolvedValue([MOCK_PRISMA_DATA]);

      const resultado = await repository.findAll();

      expect(resultado[0].itens).toHaveLength(2);
      expect(resultado[0].itens[0]).toEqual({
        id: 'item-1',
        id_pedido_fornecedor: 'pedido-1',
        id_peca: 'peca-1',
        quantidade_solicitada: 10,
        quantidade_recebida: 0,
      });
    });
  });

  describe('mapToEntity', () => {
    it('deve mapear dados do Prisma para entidade corretamente', async () => {
      // Testamos o mapeamento através do método create
      const createData = {
        fornecedor_id: 'fornecedor-1',
        itens: [{ id_peca: 'peca-1', quantidade_solicitada: 10 }],
        status: 'PENDENTE' as const,
        criado_em: new Date('2024-01-01'),
      };

      prismaService.pedidoFornecedor.create.mockResolvedValue(MOCK_PRISMA_DATA);

      const resultado = await repository.create(createData);

      // Verifica se todos os campos foram mapeados corretamente
      expect(resultado.id).toBe(MOCK_PRISMA_DATA.id);
      expect(resultado.fornecedor_id).toBe(MOCK_PRISMA_DATA.fornecedor_id);
      expect(resultado.status).toBe(MOCK_PRISMA_DATA.status);
      expect(resultado.criado_em).toBe(MOCK_PRISMA_DATA.criado_em);
      expect(resultado.atualizado_em).toBe(MOCK_PRISMA_DATA.atualizado_em);
      expect(resultado.itens).toHaveLength(MOCK_PRISMA_DATA.itens.length);
    });

    it('deve mapear status RECEBIDO corretamente', async () => {
      const mockDataRecebido = {
        ...MOCK_PRISMA_DATA,
        status: 'RECEBIDO',
      };

      prismaService.pedidoFornecedor.findUnique.mockResolvedValue(mockDataRecebido);

      const resultado = await repository.findById('pedido-1');

      expect(resultado?.status).toBe('RECEBIDO');
    });
  });
});
