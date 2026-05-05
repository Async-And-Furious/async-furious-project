import { OsPeca } from '@/modules/ordem-servico/domain/entities/os-peca.entity';

describe('OsPeca', () => {
  describe('criação da entidade', () => {
    it('deve criar uma instância de OsPeca com todas as propriedades', () => {
      const osPeca = new OsPeca();
      osPeca.id = '123e4567-e89b-12d3-a456-426614174000';
      osPeca.id_ordem_servico = '456e7890-e89b-12d3-a456-426614174001';
      osPeca.id_peca = '789e0123-e89b-12d3-a456-426614174002';
      osPeca.quantidade = 2;
      osPeca.preco_unitario = 50;
      osPeca.valor_total = 100;
      osPeca.created_at = new Date('2024-01-01T10:00:00Z');
      osPeca.updated_at = new Date('2024-01-01T10:00:00Z');

      expect(osPeca).toBeInstanceOf(OsPeca);
      expect(osPeca.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(osPeca.id_ordem_servico).toBe('456e7890-e89b-12d3-a456-426614174001');
      expect(osPeca.id_peca).toBe('789e0123-e89b-12d3-a456-426614174002');
      expect(osPeca.quantidade).toBe(2);
      expect(osPeca.preco_unitario).toBe(50);
      expect(osPeca.valor_total).toBe(100);
      expect(osPeca.created_at).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(osPeca.updated_at).toEqual(new Date('2024-01-01T10:00:00Z'));
    });

    it('deve calcular valor total corretamente', () => {
      const osPeca = new OsPeca();
      osPeca.id = '1';
      osPeca.id_ordem_servico = '2';
      osPeca.id_peca = '3';
      osPeca.quantidade = 3;
      osPeca.preco_unitario = 25.5;
      osPeca.valor_total = osPeca.quantidade * osPeca.preco_unitario;
      osPeca.created_at = new Date();
      osPeca.updated_at = new Date();

      expect(osPeca.valor_total).toBe(76.5);
      expect(osPeca.quantidade * osPeca.preco_unitario).toBe(osPeca.valor_total);
    });

    it('deve permitir diferentes quantidades de peças', () => {
      const osPecaUnica = new OsPeca();
      osPecaUnica.id = '1';
      osPecaUnica.id_ordem_servico = '2';
      osPecaUnica.id_peca = '3';
      osPecaUnica.quantidade = 1;
      osPecaUnica.preco_unitario = 100;
      osPecaUnica.valor_total = 100;
      osPecaUnica.created_at = new Date();
      osPecaUnica.updated_at = new Date();

      const osPecaMultipla = new OsPeca();
      osPecaMultipla.id = '4';
      osPecaMultipla.id_ordem_servico = '5';
      osPecaMultipla.id_peca = '6';
      osPecaMultipla.quantidade = 10;
      osPecaMultipla.preco_unitario = 15;
      osPecaMultipla.valor_total = 150;
      osPecaMultipla.created_at = new Date();
      osPecaMultipla.updated_at = new Date();

      expect(osPecaUnica.quantidade).toBe(1);
      expect(osPecaMultipla.quantidade).toBe(10);
      expect(osPecaMultipla.valor_total).toBeGreaterThan(osPecaUnica.valor_total);
    });

    it('deve manter consistência entre created_at e updated_at', () => {
      const agora = new Date();
      const osPeca = new OsPeca();
      osPeca.id = '123';
      osPeca.id_ordem_servico = '456';
      osPeca.id_peca = '789';
      osPeca.quantidade = 1;
      osPeca.preco_unitario = 50;
      osPeca.valor_total = 50;
      osPeca.created_at = agora;
      osPeca.updated_at = agora;

      expect(osPeca.created_at).toEqual(osPeca.updated_at);
    });

    it('deve permitir preços decimais', () => {
      const osPeca = new OsPeca();
      osPeca.id = '456';
      osPeca.id_ordem_servico = '789';
      osPeca.id_peca = '012';
      osPeca.quantidade = 2;
      osPeca.preco_unitario = 33.75;
      osPeca.valor_total = 67.5;
      osPeca.created_at = new Date();
      osPeca.updated_at = new Date();

      expect(osPeca.preco_unitario).toBe(33.75);
      expect(osPeca.valor_total).toBe(67.5);
      expect(typeof osPeca.preco_unitario).toBe('number');
      expect(typeof osPeca.valor_total).toBe('number');
    });
  });

  describe('propriedades da entidade', () => {
    let osPeca: OsPeca;

    beforeEach(() => {
      osPeca = new OsPeca();
    });

    it('deve ter propriedade id do tipo string', () => {
      osPeca.id = 'test-id';
      expect(typeof osPeca.id).toBe('string');
    });

    it('deve ter propriedade id_ordem_servico do tipo string', () => {
      osPeca.id_ordem_servico = 'ordem-123';
      expect(typeof osPeca.id_ordem_servico).toBe('string');
    });

    it('deve ter propriedade id_peca do tipo string', () => {
      osPeca.id_peca = 'peca-456';
      expect(typeof osPeca.id_peca).toBe('string');
    });

    it('deve ter propriedade quantidade do tipo number', () => {
      osPeca.quantidade = 5;
      expect(typeof osPeca.quantidade).toBe('number');
      expect(osPeca.quantidade).toBeGreaterThan(0);
    });

    it('deve ter propriedade preco_unitario do tipo number', () => {
      osPeca.preco_unitario = 25.99;
      expect(typeof osPeca.preco_unitario).toBe('number');
      expect(osPeca.preco_unitario).toBeGreaterThan(0);
    });

    it('deve ter propriedade valor_total do tipo number', () => {
      osPeca.valor_total = 129.95;
      expect(typeof osPeca.valor_total).toBe('number');
      expect(osPeca.valor_total).toBeGreaterThan(0);
    });

    it('deve ter propriedades de data created_at e updated_at', () => {
      const data = new Date();
      osPeca.created_at = data;
      osPeca.updated_at = data;

      expect(osPeca.created_at).toBeInstanceOf(Date);
      expect(osPeca.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('relacionamentos', () => {
    it('deve manter referências corretas para ordem de serviço e peça', () => {
      const osPeca = new OsPeca();
      osPeca.id = 'os-peca-1';
      osPeca.id_ordem_servico = 'ordem-servico-123';
      osPeca.id_peca = 'peca-filtro-oleo';
      osPeca.quantidade = 1;
      osPeca.preco_unitario = 45;
      osPeca.valor_total = 45;
      osPeca.created_at = new Date();
      osPeca.updated_at = new Date();

      expect(osPeca.id_ordem_servico).toBe('ordem-servico-123');
      expect(osPeca.id_peca).toBe('peca-filtro-oleo');
      expect(osPeca.id_ordem_servico).not.toBe(osPeca.id_peca);
    });

    it('deve permitir múltiplas peças para a mesma ordem de serviço', () => {
      const osPeca1 = new OsPeca();
      osPeca1.id = 'os-peca-1';
      osPeca1.id_ordem_servico = 'ordem-123';
      osPeca1.id_peca = 'peca-1';
      osPeca1.quantidade = 1;
      osPeca1.preco_unitario = 50;
      osPeca1.valor_total = 50;
      osPeca1.created_at = new Date();
      osPeca1.updated_at = new Date();

      const osPeca2 = new OsPeca();
      osPeca2.id = 'os-peca-2';
      osPeca2.id_ordem_servico = 'ordem-123';
      osPeca2.id_peca = 'peca-2';
      osPeca2.quantidade = 2;
      osPeca2.preco_unitario = 25;
      osPeca2.valor_total = 50;
      osPeca2.created_at = new Date();
      osPeca2.updated_at = new Date();

      expect(osPeca1.id_ordem_servico).toBe(osPeca2.id_ordem_servico);
      expect(osPeca1.id_peca).not.toBe(osPeca2.id_peca);
      expect(osPeca1.id).not.toBe(osPeca2.id);
    });
  });
});
