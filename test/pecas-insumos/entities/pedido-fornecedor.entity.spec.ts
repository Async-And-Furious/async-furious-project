import {
  PedidoFornecedor,
  PedidoFornecedorItem,
} from '@/modules/pecas-insumos/domain/entities/pedido-fornecedor.entity';

describe('PedidoFornecedorItem', () => {
  describe('criação da entidade', () => {
    it('deve criar uma instância de PedidoFornecedorItem com todas as propriedades', () => {
      const item = new PedidoFornecedorItem();
      item.id = '123e4567-e89b-12d3-a456-426614174000';
      item.id_pedido_fornecedor = '456e7890-e89b-12d3-a456-426614174001';
      item.id_peca = '789e0123-e89b-12d3-a456-426614174002';
      item.quantidade_solicitada = 10;
      item.quantidade_recebida = 8;

      expect(item).toBeInstanceOf(PedidoFornecedorItem);
      expect(item.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(item.id_pedido_fornecedor).toBe('456e7890-e89b-12d3-a456-426614174001');
      expect(item.id_peca).toBe('789e0123-e89b-12d3-a456-426614174002');
      expect(item.quantidade_solicitada).toBe(10);
      expect(item.quantidade_recebida).toBe(8);
    });

    it('deve permitir quantidade recebida menor que solicitada', () => {
      const item = new PedidoFornecedorItem();
      item.id = '1';
      item.id_pedido_fornecedor = '2';
      item.id_peca = '3';
      item.quantidade_solicitada = 15;
      item.quantidade_recebida = 12;

      expect(item.quantidade_recebida).toBeLessThan(item.quantidade_solicitada);
      expect(item.quantidade_solicitada - item.quantidade_recebida).toBe(3);
    });

    it('deve permitir quantidade recebida igual à solicitada', () => {
      const item = new PedidoFornecedorItem();
      item.id = '1';
      item.id_pedido_fornecedor = '2';
      item.id_peca = '3';
      item.quantidade_solicitada = 20;
      item.quantidade_recebida = 20;

      expect(item.quantidade_recebida).toBe(item.quantidade_solicitada);
    });

    it('deve permitir quantidade recebida zero', () => {
      const item = new PedidoFornecedorItem();
      item.id = '1';
      item.id_pedido_fornecedor = '2';
      item.id_peca = '3';
      item.quantidade_solicitada = 5;
      item.quantidade_recebida = 0;

      expect(item.quantidade_recebida).toBe(0);
      expect(item.quantidade_solicitada).toBeGreaterThan(item.quantidade_recebida);
    });
  });

  describe('propriedades da entidade', () => {
    let item: PedidoFornecedorItem;

    beforeEach(() => {
      item = new PedidoFornecedorItem();
    });

    it('deve ter propriedade id do tipo string', () => {
      item.id = 'test-id';
      expect(typeof item.id).toBe('string');
    });

    it('deve ter propriedade id_pedido_fornecedor do tipo string', () => {
      item.id_pedido_fornecedor = 'pedido-123';
      expect(typeof item.id_pedido_fornecedor).toBe('string');
    });

    it('deve ter propriedade id_peca do tipo string', () => {
      item.id_peca = 'peca-456';
      expect(typeof item.id_peca).toBe('string');
    });

    it('deve ter propriedade quantidade_solicitada do tipo number', () => {
      item.quantidade_solicitada = 25;
      expect(typeof item.quantidade_solicitada).toBe('number');
      expect(item.quantidade_solicitada).toBeGreaterThan(0);
    });

    it('deve ter propriedade quantidade_recebida do tipo number', () => {
      item.quantidade_recebida = 20;
      expect(typeof item.quantidade_recebida).toBe('number');
      expect(item.quantidade_recebida).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('PedidoFornecedor', () => {
  describe('criação da entidade', () => {
    it('deve criar uma instância de PedidoFornecedor com todas as propriedades', () => {
      const pedido = new PedidoFornecedor();
      pedido.id = '123e4567-e89b-12d3-a456-426614174000';
      pedido.fornecedor_id = '456e7890-e89b-12d3-a456-426614174001';
      pedido.status = 'PENDENTE';
      pedido.criado_em = new Date('2024-01-01T10:00:00Z');
      pedido.atualizado_em = new Date('2024-01-01T10:00:00Z');
      pedido.itens = [];

      expect(pedido).toBeInstanceOf(PedidoFornecedor);
      expect(pedido.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(pedido.fornecedor_id).toBe('456e7890-e89b-12d3-a456-426614174001');
      expect(pedido.status).toBe('PENDENTE');
      expect(pedido.criado_em).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(pedido.atualizado_em).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(pedido.itens).toEqual([]);
    });

    it('deve permitir status PENDENTE', () => {
      const pedido = new PedidoFornecedor();
      pedido.id = '1';
      pedido.fornecedor_id = '2';
      pedido.status = 'PENDENTE';
      pedido.criado_em = new Date();
      pedido.atualizado_em = new Date();
      pedido.itens = [];

      expect(pedido.status).toBe('PENDENTE');
    });

    it('deve permitir status RECEBIDO', () => {
      const pedido = new PedidoFornecedor();
      pedido.id = '1';
      pedido.fornecedor_id = '2';
      pedido.status = 'RECEBIDO';
      pedido.criado_em = new Date();
      pedido.atualizado_em = new Date();
      pedido.itens = [];

      expect(pedido.status).toBe('RECEBIDO');
    });

    it('deve permitir múltiplos itens no pedido', () => {
      const item1 = new PedidoFornecedorItem();
      item1.id = 'item-1';
      item1.id_pedido_fornecedor = 'pedido-1';
      item1.id_peca = 'peca-1';
      item1.quantidade_solicitada = 10;
      item1.quantidade_recebida = 10;

      const item2 = new PedidoFornecedorItem();
      item2.id = 'item-2';
      item2.id_pedido_fornecedor = 'pedido-1';
      item2.id_peca = 'peca-2';
      item2.quantidade_solicitada = 5;
      item2.quantidade_recebida = 3;

      const pedido = new PedidoFornecedor();
      pedido.id = 'pedido-1';
      pedido.fornecedor_id = 'fornecedor-1';
      pedido.status = 'RECEBIDO';
      pedido.criado_em = new Date();
      pedido.atualizado_em = new Date();
      pedido.itens = [item1, item2];

      expect(pedido.itens).toHaveLength(2);
      expect(pedido.itens[0]).toBe(item1);
      expect(pedido.itens[1]).toBe(item2);
      expect(pedido.itens.every((item) => item.id_pedido_fornecedor === pedido.id)).toBe(true);
    });

    it('deve manter consistência entre criado_em e atualizado_em', () => {
      const agora = new Date();
      const pedido = new PedidoFornecedor();
      pedido.id = '123';
      pedido.fornecedor_id = '456';
      pedido.status = 'PENDENTE';
      pedido.criado_em = agora;
      pedido.atualizado_em = agora;
      pedido.itens = [];

      expect(pedido.criado_em).toEqual(pedido.atualizado_em);
    });
  });

  describe('propriedades da entidade', () => {
    let pedido: PedidoFornecedor;

    beforeEach(() => {
      pedido = new PedidoFornecedor();
    });

    it('deve ter propriedade id do tipo string', () => {
      pedido.id = 'test-id';
      expect(typeof pedido.id).toBe('string');
    });

    it('deve ter propriedade fornecedor_id do tipo string', () => {
      pedido.fornecedor_id = 'fornecedor-123';
      expect(typeof pedido.fornecedor_id).toBe('string');
    });

    it('deve ter propriedade status com valores válidos', () => {
      pedido.status = 'PENDENTE';
      expect(pedido.status).toBe('PENDENTE');

      pedido.status = 'RECEBIDO';
      expect(pedido.status).toBe('RECEBIDO');
    });

    it('deve ter propriedades de data criado_em e atualizado_em', () => {
      const data = new Date();
      pedido.criado_em = data;
      pedido.atualizado_em = data;

      expect(pedido.criado_em).toBeInstanceOf(Date);
      expect(pedido.atualizado_em).toBeInstanceOf(Date);
    });

    it('deve ter propriedade itens como array', () => {
      pedido.itens = [];
      expect(Array.isArray(pedido.itens)).toBe(true);
      expect(pedido.itens).toHaveLength(0);
    });
  });

  describe('relacionamentos', () => {
    it('deve manter referência correta para fornecedor', () => {
      const pedido = new PedidoFornecedor();
      pedido.id = 'pedido-1';
      pedido.fornecedor_id = 'fornecedor-abc';
      pedido.status = 'PENDENTE';
      pedido.criado_em = new Date();
      pedido.atualizado_em = new Date();
      pedido.itens = [];

      expect(pedido.fornecedor_id).toBe('fornecedor-abc');
    });

    it('deve permitir múltiplos pedidos para o mesmo fornecedor', () => {
      const pedido1 = new PedidoFornecedor();
      pedido1.id = 'pedido-1';
      pedido1.fornecedor_id = 'fornecedor-123';
      pedido1.status = 'PENDENTE';
      pedido1.criado_em = new Date();
      pedido1.atualizado_em = new Date();
      pedido1.itens = [];

      const pedido2 = new PedidoFornecedor();
      pedido2.id = 'pedido-2';
      pedido2.fornecedor_id = 'fornecedor-123';
      pedido2.status = 'RECEBIDO';
      pedido2.criado_em = new Date();
      pedido2.atualizado_em = new Date();
      pedido2.itens = [];

      expect(pedido1.fornecedor_id).toBe(pedido2.fornecedor_id);
      expect(pedido1.id).not.toBe(pedido2.id);
      expect(pedido1.status).not.toBe(pedido2.status);
    });

    it('deve manter integridade entre pedido e seus itens', () => {
      const pedidoId = 'pedido-principal';

      const item = new PedidoFornecedorItem();
      item.id = 'item-1';
      item.id_pedido_fornecedor = pedidoId;
      item.id_peca = 'peca-1';
      item.quantidade_solicitada = 15;
      item.quantidade_recebida = 15;

      const pedido = new PedidoFornecedor();
      pedido.id = pedidoId;
      pedido.fornecedor_id = 'fornecedor-1';
      pedido.status = 'RECEBIDO';
      pedido.criado_em = new Date();
      pedido.atualizado_em = new Date();
      pedido.itens = [item];

      expect(pedido.itens[0].id_pedido_fornecedor).toBe(pedido.id);
    });
  });
});
