import { PecaInsumo } from '@/modules/pecas-insumos/domain/entities/peca-insumo.entity';

describe('PecaInsumo Entity', () => {
  let pecaInsumo: PecaInsumo;

  beforeEach(() => {
    pecaInsumo = new PecaInsumo();
    pecaInsumo.id = 'peca-1';
    pecaInsumo.nome = 'Filtro de Óleo';
    pecaInsumo.codigo = 'FO-001';
    pecaInsumo.descricao = 'Filtro de óleo para motor 1.0';
    pecaInsumo.preco = 25.9;
    pecaInsumo.quantidade_estoque = 50;
    pecaInsumo.quantidade_minima = 10;
    pecaInsumo.created_at = new Date();
    pecaInsumo.updated_at = new Date();
  });

  describe('receberDoFornecedor', () => {
    it('deve aumentar o estoque quando receber quantidade válida', () => {
      const estoqueInicial = pecaInsumo.quantidade_estoque;
      const quantidadeRecebida = 20;

      pecaInsumo.receberDoFornecedor(quantidadeRecebida);

      expect(pecaInsumo.quantidade_estoque).toBe(estoqueInicial + quantidadeRecebida);
    });

    it('deve lançar erro quando quantidade recebida for zero', () => {
      expect(() => {
        pecaInsumo.receberDoFornecedor(0);
      }).toThrow('Quantidade recebida deve ser positiva');
    });

    it('deve lançar erro quando quantidade recebida for negativa', () => {
      expect(() => {
        pecaInsumo.receberDoFornecedor(-5);
      }).toThrow('Quantidade recebida deve ser positiva');
    });

    it('deve permitir receber grandes quantidades', () => {
      const estoqueInicial = pecaInsumo.quantidade_estoque;
      const quantidadeRecebida = 1000;

      pecaInsumo.receberDoFornecedor(quantidadeRecebida);

      expect(pecaInsumo.quantidade_estoque).toBe(estoqueInicial + quantidadeRecebida);
    });
  });

  describe('podeAtenderReserva', () => {
    it('deve retornar true quando estoque é suficiente', () => {
      const quantidadeNecessaria = 30;

      const resultado = pecaInsumo.podeAtenderReserva(quantidadeNecessaria);

      expect(resultado).toBe(true);
    });

    it('deve retornar true quando estoque é exatamente igual à quantidade necessária', () => {
      const quantidadeNecessaria = pecaInsumo.quantidade_estoque;

      const resultado = pecaInsumo.podeAtenderReserva(quantidadeNecessaria);

      expect(resultado).toBe(true);
    });

    it('deve retornar false quando estoque é insuficiente', () => {
      const quantidadeNecessaria = pecaInsumo.quantidade_estoque + 1;

      const resultado = pecaInsumo.podeAtenderReserva(quantidadeNecessaria);

      expect(resultado).toBe(false);
    });

    it('deve retornar true para quantidade zero', () => {
      const resultado = pecaInsumo.podeAtenderReserva(0);

      expect(resultado).toBe(true);
    });

    it('deve funcionar corretamente com estoque zerado', () => {
      pecaInsumo.quantidade_estoque = 0;

      expect(pecaInsumo.podeAtenderReserva(0)).toBe(true);
      expect(pecaInsumo.podeAtenderReserva(1)).toBe(false);
    });
  });

  describe('debitarEstoque', () => {
    it('deve reduzir o estoque quando quantidade é válida e suficiente', () => {
      const estoqueInicial = pecaInsumo.quantidade_estoque;
      const quantidadeDebitar = 20;

      pecaInsumo.debitarEstoque(quantidadeDebitar);

      expect(pecaInsumo.quantidade_estoque).toBe(estoqueInicial - quantidadeDebitar);
    });

    it('deve permitir debitar todo o estoque', () => {
      const quantidadeDebitar = pecaInsumo.quantidade_estoque;

      pecaInsumo.debitarEstoque(quantidadeDebitar);

      expect(pecaInsumo.quantidade_estoque).toBe(0);
    });

    it('deve lançar erro quando quantidade for zero', () => {
      expect(() => {
        pecaInsumo.debitarEstoque(0);
      }).toThrow('Quantidade deve ser positiva');
    });

    it('deve lançar erro quando quantidade for negativa', () => {
      expect(() => {
        pecaInsumo.debitarEstoque(-5);
      }).toThrow('Quantidade deve ser positiva');
    });

    it('deve lançar erro quando estoque for insuficiente', () => {
      const quantidadeDebitar = pecaInsumo.quantidade_estoque + 1;

      expect(() => {
        pecaInsumo.debitarEstoque(quantidadeDebitar);
      }).toThrow(
        `Estoque insuficiente para ${pecaInsumo.nome}: disponível=${pecaInsumo.quantidade_estoque}, solicitado=${quantidadeDebitar}`
      );
    });

    it('deve manter estoque inalterado quando erro ocorre', () => {
      const estoqueInicial = pecaInsumo.quantidade_estoque;

      try {
        pecaInsumo.debitarEstoque(estoqueInicial + 10);
      } catch {
        // Ignora o erro para testar se estoque não mudou
      }

      expect(pecaInsumo.quantidade_estoque).toBe(estoqueInicial);
    });
  });

  describe('estaBelowMinimo', () => {
    it('deve retornar true quando estoque está abaixo do mínimo', () => {
      pecaInsumo.quantidade_estoque = pecaInsumo.quantidade_minima - 1;

      const resultado = pecaInsumo.estaBelowMinimo();

      expect(resultado).toBe(true);
    });

    it('deve retornar false quando estoque está igual ao mínimo', () => {
      pecaInsumo.quantidade_estoque = pecaInsumo.quantidade_minima;

      const resultado = pecaInsumo.estaBelowMinimo();

      expect(resultado).toBe(false);
    });

    it('deve retornar false quando estoque está acima do mínimo', () => {
      pecaInsumo.quantidade_estoque = pecaInsumo.quantidade_minima + 1;

      const resultado = pecaInsumo.estaBelowMinimo();

      expect(resultado).toBe(false);
    });

    it('deve funcionar corretamente com estoque zerado e mínimo zero', () => {
      pecaInsumo.quantidade_estoque = 0;
      pecaInsumo.quantidade_minima = 0;

      const resultado = pecaInsumo.estaBelowMinimo();

      expect(resultado).toBe(false);
    });

    it('deve funcionar corretamente com estoque zerado e mínimo positivo', () => {
      pecaInsumo.quantidade_estoque = 0;
      pecaInsumo.quantidade_minima = 5;

      const resultado = pecaInsumo.estaBelowMinimo();

      expect(resultado).toBe(true);
    });
  });

  describe('Cenários integrados', () => {
    it('deve gerenciar estoque corretamente em operações sequenciais', () => {
      // Estado inicial
      expect(pecaInsumo.quantidade_estoque).toBe(50);
      expect(pecaInsumo.estaBelowMinimo()).toBe(false);

      // Debitar estoque
      pecaInsumo.debitarEstoque(30);
      expect(pecaInsumo.quantidade_estoque).toBe(20);
      expect(pecaInsumo.estaBelowMinimo()).toBe(false);

      // Debitar mais estoque até ficar abaixo do mínimo
      pecaInsumo.debitarEstoque(15);
      expect(pecaInsumo.quantidade_estoque).toBe(5);
      expect(pecaInsumo.estaBelowMinimo()).toBe(true);

      // Receber do fornecedor
      pecaInsumo.receberDoFornecedor(25);
      expect(pecaInsumo.quantidade_estoque).toBe(30);
      expect(pecaInsumo.estaBelowMinimo()).toBe(false);
    });

    it('deve validar reservas após operações de estoque', () => {
      // Debitar estoque
      pecaInsumo.debitarEstoque(40);
      expect(pecaInsumo.quantidade_estoque).toBe(10);

      // Verificar se pode atender reservas
      expect(pecaInsumo.podeAtenderReserva(5)).toBe(true);
      expect(pecaInsumo.podeAtenderReserva(10)).toBe(true);
      expect(pecaInsumo.podeAtenderReserva(15)).toBe(false);

      // Receber mais estoque
      pecaInsumo.receberDoFornecedor(20);
      expect(pecaInsumo.quantidade_estoque).toBe(30);
      expect(pecaInsumo.podeAtenderReserva(15)).toBe(true);
    });
  });
});
