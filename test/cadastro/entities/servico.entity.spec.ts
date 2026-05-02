import { Servico } from '@/modules/cadastro/domain/entities/servico.entity';

describe('Servico', () => {
  describe('criação da entidade', () => {
    it('deve criar uma instância de Servico com todas as propriedades', () => {
      const servico = new Servico();
      servico.id = '123e4567-e89b-12d3-a456-426614174000';
      servico.nome = 'Troca de óleo';
      servico.descricao = 'Troca de óleo do motor com filtro';
      servico.preco = 150;
      servico.created_at = new Date('2024-01-01T10:00:00Z');
      servico.updated_at = new Date('2024-01-01T10:00:00Z');

      expect(servico).toBeInstanceOf(Servico);
      expect(servico.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(servico.nome).toBe('Troca de óleo');
      expect(servico.descricao).toBe('Troca de óleo do motor com filtro');
      expect(servico.preco).toBe(150);
      expect(servico.created_at).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(servico.updated_at).toEqual(new Date('2024-01-01T10:00:00Z'));
    });

    it('deve permitir descrição nula', () => {
      const servico = new Servico();
      servico.id = '123e4567-e89b-12d3-a456-426614174000';
      servico.nome = 'Alinhamento';
      servico.descricao = null;
      servico.preco = 80;
      servico.created_at = new Date();
      servico.updated_at = new Date();

      expect(servico.descricao).toBeNull();
      expect(servico.nome).toBe('Alinhamento');
      expect(servico.preco).toBe(80);
    });

    it('deve permitir diferentes tipos de serviços', () => {
      const servicoBasico = new Servico();
      servicoBasico.id = '1';
      servicoBasico.nome = 'Lavagem simples';
      servicoBasico.descricao = 'Lavagem externa do veículo';
      servicoBasico.preco = 25;
      servicoBasico.created_at = new Date();
      servicoBasico.updated_at = new Date();

      const servicoComplexo = new Servico();
      servicoComplexo.id = '2';
      servicoComplexo.nome = 'Revisão completa';
      servicoComplexo.descricao = 'Revisão completa do sistema elétrico e mecânico';
      servicoComplexo.preco = 500;
      servicoComplexo.created_at = new Date();
      servicoComplexo.updated_at = new Date();

      expect(servicoBasico.preco).toBeLessThan(servicoComplexo.preco);
      expect(servicoBasico.nome).not.toBe(servicoComplexo.nome);
    });

    it('deve manter consistência entre created_at e updated_at', () => {
      const agora = new Date();
      const servico = new Servico();
      servico.id = '123';
      servico.nome = 'Balanceamento';
      servico.descricao = 'Balanceamento das rodas';
      servico.preco = 60;
      servico.created_at = agora;
      servico.updated_at = agora;

      expect(servico.created_at).toEqual(servico.updated_at);
    });

    it('deve permitir preços decimais', () => {
      const servico = new Servico();
      servico.id = '456';
      servico.nome = 'Calibragem';
      servico.descricao = 'Calibragem dos pneus';
      servico.preco = 15.5;
      servico.created_at = new Date();
      servico.updated_at = new Date();

      expect(servico.preco).toBe(15.5);
      expect(typeof servico.preco).toBe('number');
    });
  });

  describe('propriedades da entidade', () => {
    let servico: Servico;

    beforeEach(() => {
      servico = new Servico();
    });

    it('deve ter propriedade id do tipo string', () => {
      servico.id = 'test-id';
      expect(typeof servico.id).toBe('string');
    });

    it('deve ter propriedade nome do tipo string', () => {
      servico.nome = 'Teste Serviço';
      expect(typeof servico.nome).toBe('string');
    });

    it('deve ter propriedade descricao que pode ser string ou null', () => {
      servico.descricao = 'Descrição teste';
      expect(typeof servico.descricao).toBe('string');

      servico.descricao = null;
      expect(servico.descricao).toBeNull();
    });

    it('deve ter propriedade preco do tipo number', () => {
      servico.preco = 100;
      expect(typeof servico.preco).toBe('number');
    });

    it('deve ter propriedades de data created_at e updated_at', () => {
      const data = new Date();
      servico.created_at = data;
      servico.updated_at = data;

      expect(servico.created_at).toBeInstanceOf(Date);
      expect(servico.updated_at).toBeInstanceOf(Date);
    });
  });
});
