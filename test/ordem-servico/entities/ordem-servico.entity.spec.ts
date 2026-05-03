import {
  OrdemDeServico,
  OSStatus,
} from '../../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';

describe('OrdemDeServico Entity', () => {
  it('deve criar uma instância de OrdemDeServico', () => {
    const ordemServico = new OrdemDeServico();

    expect(ordemServico).toBeDefined();
    expect(ordemServico).toBeInstanceOf(OrdemDeServico);
  });

  it('deve permitir definir todas as propriedades', () => {
    const ordemServico = new OrdemDeServico();
    const agora = new Date();

    ordemServico.id = 'os-123';
    ordemServico.veiculoId = 'veiculo-456';
    ordemServico.clienteId = 'cliente-789';
    ordemServico.status = 'RECEIVED';
    ordemServico.descricao = 'Problema no motor';
    ordemServico.iniciada_em = agora;
    ordemServico.finalizada_em = null;
    ordemServico.entregue_em = null;
    ordemServico.created_at = agora;
    ordemServico.updated_at = agora;

    expect(ordemServico.id).toBe('os-123');
    expect(ordemServico.veiculoId).toBe('veiculo-456');
    expect(ordemServico.clienteId).toBe('cliente-789');
    expect(ordemServico.status).toBe('RECEIVED');
    expect(ordemServico.descricao).toBe('Problema no motor');
    expect(ordemServico.iniciada_em).toBe(agora);
    expect(ordemServico.finalizada_em).toBeNull();
    expect(ordemServico.entregue_em).toBeNull();
    expect(ordemServico.created_at).toBe(agora);
    expect(ordemServico.updated_at).toBe(agora);
  });

  it('deve permitir descricao nula', () => {
    const ordemServico = new OrdemDeServico();
    ordemServico.descricao = null;

    expect(ordemServico.descricao).toBeNull();
  });

  it('deve permitir datas nulas para campos opcionais', () => {
    const ordemServico = new OrdemDeServico();

    ordemServico.iniciada_em = null;
    ordemServico.finalizada_em = null;
    ordemServico.entregue_em = null;

    expect(ordemServico.iniciada_em).toBeNull();
    expect(ordemServico.finalizada_em).toBeNull();
    expect(ordemServico.entregue_em).toBeNull();
  });

  describe('OSStatus', () => {
    it('deve aceitar todos os status válidos', () => {
      const statusValidos: OSStatus[] = [
        'RECEIVED',
        'UNDER_DIAGNOSIS',
        'AWAITING_APPROVAL',
        'IN_PROGRESS',
        'AWAITING_PARTS',
        'FINISHED',
        'DELIVERED',
        'CLOSED_WITHOUT_EXECUTION',
      ];

      statusValidos.forEach((status) => {
        const ordemServico = new OrdemDeServico();
        ordemServico.status = status;
        expect(ordemServico.status).toBe(status);
      });
    });

    it('deve permitir transições de status', () => {
      const ordemServico = new OrdemDeServico();

      ordemServico.status = 'RECEIVED';
      expect(ordemServico.status).toBe('RECEIVED');

      ordemServico.status = 'UNDER_DIAGNOSIS';
      expect(ordemServico.status).toBe('UNDER_DIAGNOSIS');

      ordemServico.status = 'AWAITING_APPROVAL';
      expect(ordemServico.status).toBe('AWAITING_APPROVAL');

      ordemServico.status = 'IN_PROGRESS';
      expect(ordemServico.status).toBe('IN_PROGRESS');

      ordemServico.status = 'FINISHED';
      expect(ordemServico.status).toBe('FINISHED');

      ordemServico.status = 'DELIVERED';
      expect(ordemServico.status).toBe('DELIVERED');
    });
  });

  it('deve permitir associar um orçamento', () => {
    const ordemServico = new OrdemDeServico();
    const orcamento = {
      id: 'orc-123',
      id_ordem_servico: 'os-123',
      valor_total_servicos: 300.0,
      valor_total_pecas: 200.0,
      valor_total_geral: 500.0,
      status: 'PENDING' as const,
      created_at: new Date(),
      updated_at: new Date(),
    };

    ordemServico.orcamento = orcamento;

    expect(ordemServico.orcamento).toBeDefined();
    expect(ordemServico.orcamento?.id).toBe('orc-123');
    expect(ordemServico.orcamento?.valor_total_geral).toBe(500.0);
  });

  it('deve funcionar sem orçamento associado', () => {
    const ordemServico = new OrdemDeServico();

    expect(ordemServico.orcamento).toBeUndefined();
  });

  it('deve permitir criar com dados completos', () => {
    const agora = new Date();
    const ordemServico = new OrdemDeServico();

    // Simulando dados completos de uma OS finalizada
    ordemServico.id = 'os-completa-123';
    ordemServico.veiculoId = 'veiculo-abc';
    ordemServico.clienteId = 'cliente-xyz';
    ordemServico.status = 'DELIVERED';
    ordemServico.descricao = 'Troca de óleo e filtros';
    ordemServico.iniciada_em = new Date(agora.getTime() - 86400000); // 1 dia atrás
    ordemServico.finalizada_em = new Date(agora.getTime() - 3600000); // 1 hora atrás
    ordemServico.entregue_em = agora;
    ordemServico.created_at = new Date(agora.getTime() - 172800000); // 2 dias atrás
    ordemServico.updated_at = agora;

    expect(ordemServico.id).toBe('os-completa-123');
    expect(ordemServico.status).toBe('DELIVERED');
    expect(ordemServico.iniciada_em).toBeDefined();
    expect(ordemServico.finalizada_em).toBeDefined();
    expect(ordemServico.entregue_em).toBeDefined();
    expect(ordemServico.created_at).toBeDefined();
    expect(ordemServico.updated_at).toBeDefined();
  });
});
