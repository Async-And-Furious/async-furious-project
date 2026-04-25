import { BadRequestException } from '@nestjs/common';
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
    valor_total_servicos: 0,
    valor_total_pecas: 0,
    valor_total_geral: 0,
    orcamento_status: 'PENDING',
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
        valor_total_servicos: 100,
        valor_total_pecas: 50,
        valor_total_geral: 150,
        orcamento_status: 'PENDING',
      };

      mockRepository.findOne.mockResolvedValue(mockOrdemDeServico);
      mockRepository.update.mockResolvedValue(ordemAtualizada);

      const result = await gerarUseCase.execute('1', {
        valor_total_servicos: 100,
        valor_total_pecas: 50,
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        valor_total_servicos: expect.any(Number),
        valor_total_pecas: expect.any(Number),
        valor_total_geral: expect.any(Number),
        orcamento_status: 'PENDING',
      });
      expect(result.orcamento_status).toBe('PENDING');
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

    it('should throw error when estimate is already approved', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockOrdemDeServico,
        orcamento_status: 'APPROVED',
      });

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
        valor_total_geral: 150,
        orcamento_status: 'APPROVED',
        status: 'IN_PROGRESS',
      };

      mockRepository.findOne.mockResolvedValue({
        ...mockOrdemDeServico,
        valor_total_geral: 150,
      });
      mockRepository.update.mockResolvedValue(ordemAprovada);

      const result = await aprovarUseCase.execute('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        orcamento_status: 'APPROVED',
        status: 'IN_PROGRESS',
      });
      expect(result.orcamento_status).toBe('APPROVED');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw error when OS not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(aprovarUseCase.execute('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when estimate is not pending', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockOrdemDeServico,
        orcamento_status: 'REJECTED',
      });

      await expect(aprovarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when estimate already approved', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockOrdemDeServico,
        orcamento_status: 'APPROVED',
        valor_total_geral: 150,
      });

      await expect(aprovarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when no budget values have been set', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockOrdemDeServico,
        orcamento_status: 'PENDING',
        valor_total_geral: 0,
      });

      await expect(aprovarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('RejeitarOrcamentoUseCase', () => {
    it('should reject a pending estimate', async () => {
      const ordemRejeitada = {
        ...mockOrdemDeServico,
        orcamento_status: 'REJECTED',
      };

      mockRepository.findOne.mockResolvedValue(mockOrdemDeServico);
      mockRepository.update.mockResolvedValue(ordemRejeitada);

      const result = await rejeitarUseCase.execute('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith('1');
      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        orcamento_status: 'REJECTED',
      });
      expect(result.orcamento_status).toBe('REJECTED');
    });

    it('should throw error when OS not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(rejeitarUseCase.execute('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw error when estimate is not pending', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockOrdemDeServico,
        orcamento_status: 'APPROVED',
      });

      await expect(rejeitarUseCase.execute('1')).rejects.toThrow(BadRequestException);
    });
  });
});
