import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  GerarOrcamentoUseCase,
  AprovarOrcamentoUseCase,
  RejeitarOrcamentoUseCase,
} from '../../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import { OrdemDeServico } from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import { Orcamento } from '../../src/modules/ordem-servico/domain/entities/orcamento.entity';

describe('Orcamento Use Cases', () => {
  let gerarUseCase: GerarOrcamentoUseCase;
  let aprovarUseCase: AprovarOrcamentoUseCase;
  let rejeitarUseCase: RejeitarOrcamentoUseCase;
  let mockOsRepository: any;
  let mockOrcamentoRepository: any;

  const mockOs: OrdemDeServico = {
    id: 'os-1',
    id_veiculo: 'veh-1',
    id_cliente: 'cli-1',
    status: 'RECEIVED',
    descricao: 'Troca de óleo',
    created_at: new Date(),
    updated_at: new Date(),
    entregue_em: null,
  };

  const mockOrcamento: Orcamento = {
    id: 'orc-1',
    id_ordem_servico: 'os-1',
    valor_total_servicos: 100,
    valor_total_pecas: 50,
    valor_total_geral: 150,
    status: 'PENDING',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockOsRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockOrcamentoRepository = {
      create: jest.fn(),
      findByOrdemServicoId: jest.fn(),
      update: jest.fn(),
    };

    gerarUseCase = new GerarOrcamentoUseCase(mockOsRepository, mockOrcamentoRepository);
    aprovarUseCase = new AprovarOrcamentoUseCase(mockOsRepository, mockOrcamentoRepository);
    rejeitarUseCase = new RejeitarOrcamentoUseCase(mockOsRepository, mockOrcamentoRepository);
  });

  describe('GerarOrcamentoUseCase', () => {
    it('should create a new orcamento when none exists', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(null);
      mockOrcamentoRepository.create.mockResolvedValue(mockOrcamento);

      const result = await gerarUseCase.execute('os-1', {
        valor_total_servicos: 100,
        valor_total_pecas: 50,
      });

      expect(mockOrcamentoRepository.create).toHaveBeenCalledWith({
        id_ordem_servico: 'os-1',
        valor_total_servicos: expect.any(Number),
        valor_total_pecas: expect.any(Number),
        valor_total_geral: expect.any(Number),
      });
      expect(result.status).toBe('PENDING');
    });

    it('should update existing orcamento when it is PENDING', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockOrcamentoRepository.update.mockResolvedValue({
        ...mockOrcamento,
        valor_total_servicos: 200,
        valor_total_geral: 250,
      });

      const result = await gerarUseCase.execute('os-1', {
        valor_total_servicos: 200,
        valor_total_pecas: 50,
      });

      expect(mockOrcamentoRepository.update).toHaveBeenCalledWith(
        'orc-1',
        expect.objectContaining({
          status: 'PENDING',
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw when OS not found', async () => {
      mockOsRepository.findOne.mockResolvedValue(null);

      await expect(
        gerarUseCase.execute('invalid', { valor_total_servicos: 100, valor_total_pecas: 50 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when orcamento is already approved', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        status: 'APPROVED',
      });

      await expect(
        gerarUseCase.execute('os-1', { valor_total_servicos: 100, valor_total_pecas: 50 })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('AprovarOrcamentoUseCase', () => {
    it('should approve a pending orcamento and set OS to IN_PROGRESS', async () => {
      const orcamentoAprovado = { ...mockOrcamento, status: 'APPROVED' as const };

      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockOsRepository.update.mockResolvedValue({ ...mockOs, status: 'IN_PROGRESS' });
      mockOrcamentoRepository.update.mockResolvedValue(orcamentoAprovado);

      const result = await aprovarUseCase.execute('os-1');

      expect(mockOsRepository.update).toHaveBeenCalledWith('os-1', { status: 'IN_PROGRESS' });
      expect(mockOrcamentoRepository.update).toHaveBeenCalledWith('orc-1', { status: 'APPROVED' });
      expect(result.status).toBe('APPROVED');
    });

    it('should throw when OS not found', async () => {
      mockOsRepository.findOne.mockResolvedValue(null);
      await expect(aprovarUseCase.execute('invalid')).rejects.toThrow(BadRequestException);
    });

    it('should throw when no orcamento exists', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(null);
      await expect(aprovarUseCase.execute('os-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when orcamento is not PENDING', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        status: 'REJECTED',
      });
      await expect(aprovarUseCase.execute('os-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw when valor_total_geral is zero', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        valor_total_geral: 0,
      });
      await expect(aprovarUseCase.execute('os-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('RejeitarOrcamentoUseCase', () => {
    it('should reject a pending orcamento', async () => {
      const orcamentoRejeitado = { ...mockOrcamento, status: 'REJECTED' as const };

      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockOrcamentoRepository.update.mockResolvedValue(orcamentoRejeitado);

      const result = await rejeitarUseCase.execute('os-1');

      expect(mockOrcamentoRepository.update).toHaveBeenCalledWith('orc-1', { status: 'REJECTED' });
      expect(result.status).toBe('REJECTED');
    });

    it('should throw when OS not found', async () => {
      mockOsRepository.findOne.mockResolvedValue(null);
      await expect(rejeitarUseCase.execute('invalid')).rejects.toThrow(BadRequestException);
    });

    it('should throw when no orcamento exists', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(null);
      await expect(rejeitarUseCase.execute('os-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when orcamento is not PENDING', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        status: 'APPROVED',
      });
      await expect(rejeitarUseCase.execute('os-1')).rejects.toThrow(BadRequestException);
    });
  });
});
