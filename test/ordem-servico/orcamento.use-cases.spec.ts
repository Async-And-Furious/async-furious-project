import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  GerarOrcamentoUseCase,
  AprovarOrcamentoUseCase,
  RejeitarOrcamentoUseCase,
} from '../../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import { OrdemDeServico } from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';

describe('Orcamento Use Cases', () => {
  let gerarUseCase: GerarOrcamentoUseCase;
  let aprovarUseCase: AprovarOrcamentoUseCase;
  let rejeitarUseCase: RejeitarOrcamentoUseCase;
  let mockRepository: any;

  const mockOrdemDeServico: OrdemDeServico = {
    id: '1',
    id_veiculo: 'veh-1',
    id_cliente: 'cli-1',
    status: 'RECEIVED',
    descricao: 'Troca de óleo',
    valor_total_servicos: new Decimal(0),
    valor_total_pecas: new Decimal(0),
    valor_total_geral: new Decimal(0),
    orcamento_status: 'PENDING',
    orcamento_aprovado: false,
    created_at: new Date(),
    updated_at: new Date(),
    entregue_em: null,
  };

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    gerarUseCase = new GerarOrcamentoUseCase(mockRepository);
    aprovarUseCase = new AprovarOrcamentoUseCase(mockRepository);
    rejeitarUseCase = new RejeitarOrcamentoUseCase(mockRepository);
  });

  describe('GerarOrcamentoUseCase', () => {
    it('should generate a new estimate successfully', async () => {
      const ordemAtualizada = {
        ...mockOrdemDeServico,
        valor_total_servicos: new Decimal(100),
        valor_total_pecas: new Decimal(50),
        valor_total_geral: new Decimal(150),
        orcamento_status: 'PENDING',
        orcamento_aprovado: false,
      };

      mockRepository.findOne.mockResolvedValue(mockOrdemDeServico);
      mockRepository.update.mockResolvedValue(ordemAtualizada);

      const result = await gerarUseCase.execute('1', {
        valor_total_servicos: 100,
        valor_total_pecas: 50,
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        valor_total_servicos: expect.any(Decimal),
        valor_total_pecas: expect.any(Decimal),
        valor_total_geral: expect.any(Decimal),
        orcamento_status: 'PENDING',
        orcamento_aprovado: false,
      });
      expect(result.orcamento_status).toBe('PENDING');
      expect(result.orcamento_aprovado).toBe(false);
    });

    it('should throw error when OS not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        gerarUseCase.execute('invalid-id', {
          valor_total_servicos: 100,
          valor_total_pecas: 50,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when trying to generate estimate with approved estimate', async () => {
      const ordemComOrcamentoAprovado = {
        ...mockOrdemDeServico,
        orcamento_aprovado: true,
        orcamento_status: 'APPROVED',
      };

      mockRepository.findOne.mockResolvedValue(ordemComOrcamentoAprovado);

      await expect(
        gerarUseCase.execute('1', {
          valor_total_servicos: 100,
          valor_total_pecas: 50,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('AprovarOrcamentoUseCase', () => {
    it('should approve a pending estimate', async () => {
      const ordemAprovada = {
        ...mockOrdemDeServico,
        orcamento_status: 'APPROVED',
        orcamento_aprovado: true,
        status: 'IN_PROGRESS',
      };

      mockRepository.findOne.mockResolvedValue(mockOrdemDeServico);
      mockRepository.update.mockResolvedValue(ordemAprovada);

      const result = await aprovarUseCase.execute('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        orcamento_status: 'APPROVED',
        orcamento_aprovado: true,
        status: 'IN_PROGRESS',
      });
      expect(result.orcamento_aprovado).toBe(true);
      expect(result.orcamento_status).toBe('APPROVED');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw error when OS not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(aprovarUseCase.execute('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when estimate is not pending', async () => {
      const ordemRejeitada = {
        ...mockOrdemDeServico,
        orcamento_status: 'REJECTED',
        orcamento_aprovado: false,
      };

      mockRepository.findOne.mockResolvedValue(ordemRejeitada);

      await expect(aprovarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when estimate already approved', async () => {
      const ordemJaAprovada = {
        ...mockOrdemDeServico,
        orcamento_status: 'APPROVED',
        orcamento_aprovado: true,
      };

      mockRepository.findOne.mockResolvedValue(ordemJaAprovada);

      await expect(aprovarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('RejeitarOrcamentoUseCase', () => {
    it('should reject a pending estimate', async () => {
      const ordemRejeitada = {
        ...mockOrdemDeServico,
        orcamento_status: 'REJECTED',
        orcamento_aprovado: false,
      };

      mockRepository.findOne.mockResolvedValue(mockOrdemDeServico);
      mockRepository.update.mockResolvedValue(ordemRejeitada);

      const result = await rejeitarUseCase.execute('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        orcamento_status: 'REJECTED',
        orcamento_aprovado: false,
      });
      expect(result.orcamento_status).toBe('REJECTED');
      expect(result.orcamento_aprovado).toBe(false);
    });

    it('should throw error when OS not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(rejeitarUseCase.execute('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when estimate is not pending', async () => {
      const ordemAprovada = {
        ...mockOrdemDeServico,
        orcamento_status: 'APPROVED',
        orcamento_aprovado: true,
      };

      mockRepository.findOne.mockResolvedValue(ordemAprovada);

      await expect(rejeitarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });
  });
});
