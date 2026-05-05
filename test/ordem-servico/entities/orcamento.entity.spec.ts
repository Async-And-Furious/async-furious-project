import { Orcamento } from '@/modules/ordem-servico/domain/entities/orcamento.entity';

describe('Orcamento Entity', () => {
  it('deve criar uma instância de Orcamento', () => {
    const orcamento = new Orcamento();
    expect(orcamento).toBeInstanceOf(Orcamento);
  });

  it('deve permitir definir todas as propriedades', () => {
    const orcamento = new Orcamento();
    const agora = new Date();

    orcamento.id = 'orc-123';
    orcamento.id_ordem_servico = 'os-456';
    orcamento.valor_total_servicos = 300.0;
    orcamento.valor_total_pecas = 200.0;
    orcamento.valor_total_geral = 500.0;
    orcamento.status = 'PENDING';
    orcamento.created_at = agora;
    orcamento.updated_at = agora;

    expect(orcamento.id).toBe('orc-123');
    expect(orcamento.id_ordem_servico).toBe('os-456');
    expect(orcamento.valor_total_servicos).toBe(300.0);
    expect(orcamento.valor_total_pecas).toBe(200.0);
    expect(orcamento.valor_total_geral).toBe(500.0);
    expect(orcamento.status).toBe('PENDING');
    expect(orcamento.created_at).toBe(agora);
    expect(orcamento.updated_at).toBe(agora);
  });

  it('deve permitir valores zero para serviços e peças', () => {
    const orcamento = new Orcamento();

    orcamento.valor_total_servicos = 0;
    orcamento.valor_total_pecas = 0;
    orcamento.valor_total_geral = 0;

    expect(orcamento.valor_total_servicos).toBe(0);
    expect(orcamento.valor_total_pecas).toBe(0);
    expect(orcamento.valor_total_geral).toBe(0);
  });

  it('deve calcular valor total corretamente', () => {
    const orcamento = new Orcamento();

    orcamento.valor_total_servicos = 150.75;
    orcamento.valor_total_pecas = 249.25;
    orcamento.valor_total_geral = orcamento.valor_total_servicos + orcamento.valor_total_pecas;

    expect(orcamento.valor_total_geral).toBe(400.0);
  });

  it('deve permitir criar com dados completos', () => {
    const dadosOrcamento = {
      id: 'orc-789',
      id_ordem_servico: 'os-101',
      valor_total_servicos: 450.0,
      valor_total_pecas: 350.0,
      valor_total_geral: 800.0,
      status: 'APPROVED' as const,
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-16'),
    };

    const orcamento = Object.assign(new Orcamento(), dadosOrcamento);

    expect(orcamento.id).toBe('orc-789');
    expect(orcamento.id_ordem_servico).toBe('os-101');
    expect(orcamento.valor_total_servicos).toBe(450.0);
    expect(orcamento.valor_total_pecas).toBe(350.0);
    expect(orcamento.valor_total_geral).toBe(800.0);
    expect(orcamento.status).toBe('APPROVED');
    expect(orcamento.created_at).toEqual(new Date('2024-01-15'));
    expect(orcamento.updated_at).toEqual(new Date('2024-01-16'));
  });

  describe('Status do Orçamento', () => {
    it('deve aceitar todos os status válidos', () => {
      const statusValidos = ['PENDING', 'APPROVED', 'REJECTED'] as const;

      statusValidos.forEach((status) => {
        const orcamento = new Orcamento();
        orcamento.status = status;
        expect(orcamento.status).toBe(status);
      });
    });

    it('deve permitir transições de status', () => {
      const orcamento = new Orcamento();

      // Inicia como PENDING
      orcamento.status = 'PENDING';
      expect(orcamento.status).toBe('PENDING');

      // Pode ser aprovado
      orcamento.status = 'APPROVED';
      expect(orcamento.status).toBe('APPROVED');

      // Ou rejeitado (simulando nova instância)
      const orcamento2 = new Orcamento();
      orcamento2.status = 'PENDING';
      orcamento2.status = 'REJECTED';
      expect(orcamento2.status).toBe('REJECTED');
    });
  });

  describe('Valores Monetários', () => {
    it('deve trabalhar com valores decimais', () => {
      const orcamento = new Orcamento();

      orcamento.valor_total_servicos = 123.45;
      orcamento.valor_total_pecas = 67.89;
      orcamento.valor_total_geral = 191.34;

      expect(orcamento.valor_total_servicos).toBe(123.45);
      expect(orcamento.valor_total_pecas).toBe(67.89);
      expect(orcamento.valor_total_geral).toBe(191.34);
    });

    it('deve trabalhar com valores grandes', () => {
      const orcamento = new Orcamento();

      orcamento.valor_total_servicos = 9999.99;
      orcamento.valor_total_pecas = 10000.01;
      orcamento.valor_total_geral = 20000.0;

      expect(orcamento.valor_total_servicos).toBe(9999.99);
      expect(orcamento.valor_total_pecas).toBe(10000.01);
      expect(orcamento.valor_total_geral).toBe(20000.0);
    });
  });
});
