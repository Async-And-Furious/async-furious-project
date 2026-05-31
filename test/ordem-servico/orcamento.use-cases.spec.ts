import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import {
  CriarOrdemServicoUseCase,
  AssumirOrdemServicoUseCase,
  AnalisarVeiculoUseCase,
  ListarServicosInsumosNaOsUseCase,
  AtualizarOrdemServicoUseCase,
  FinalizarExecucaoUseCase,
  AprovarServicoPrestadoUseCase,
  RegistrarEntregaVeiculoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  DetalharOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
} from '../../src/modules/ordem-servico/application/use-cases/ordem-servico.use-cases';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IOrcamentoRepository } from '../../src/modules/ordem-servico/domain/interfaces/orcamento.interface';
import type { IOsPecaRepository } from '../../src/modules/ordem-servico/domain/interfaces/os-peca.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import { OrdemDeServico } from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';
import type { Orcamento } from '../../src/modules/ordem-servico/domain/entities/orcamento.entity';

const makeOs = (overrides: Partial<OrdemDeServico> = {}): OrdemDeServico =>
  Object.assign(new OrdemDeServico(), {
    id: 'os-1',
    veiculoId: 'veh-1',
    clienteId: 'cli-1',
    status: 'RECEIVED' as const,
    descricao: 'Troca de óleo',
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

describe('OS + Orçamento Use Cases', () => {
  let mockOsRepository: jest.Mocked<IOrdemServicoRepository>;
  let mockOrcamentoRepository: jest.Mocked<IOrcamentoRepository>;
  let mockOsPecaRepository: jest.Mocked<IOsPecaRepository>;
  let mockBarramento: jest.Mocked<EmissorEventos>;

  const mockOs = makeOs();

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
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      remove: jest.fn(),
    } as jest.Mocked<IOrdemServicoRepository>;
    mockOrcamentoRepository = {
      create: jest.fn(),
      findByOrdemServicoId: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<IOrcamentoRepository>;
    mockOsPecaRepository = {
      replaceAll: jest.fn(),
      findByOrdemServicoId: jest.fn(),
    } as jest.Mocked<IOsPecaRepository>;
    mockBarramento = {
      emitir: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmissorEventos>;
  });

  describe('CriarOrdemServicoUseCase', () => {
    it('deve criar OS e emitir OrdemServicoCriada', async () => {
      mockOsRepository.create.mockResolvedValue(mockOs);
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new CriarOrdemServicoUseCase(mockOsRepository, mockBarramento);
      const result = await uc.execute({ veiculoId: 'veh-1', clienteId: 'cli-1' });

      expect(mockOsRepository.create).toHaveBeenCalledWith({
        veiculoId: 'veh-1',
        clienteId: 'cli-1',
      });
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('os-1');
    });
  });

  describe('AssumirOrdemServicoUseCase', () => {
    it('deve emitir OrdemServicoAssumida quando OS está RECEIVED', async () => {
      const osUpdated = makeOs({ status: 'UNDER_DIAGNOSIS' });
      mockOsRepository.findOne.mockResolvedValueOnce(mockOs).mockResolvedValueOnce(osUpdated);

      const uc = new AssumirOrdemServicoUseCase(mockOsRepository, mockBarramento);
      const result = await uc.execute('os-1');

      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('UNDER_DIAGNOSIS');
    });

    it('deve lançar DomainException quando OS não está RECEIVED', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'UNDER_DIAGNOSIS' }));

      const uc = new AssumirOrdemServicoUseCase(mockOsRepository, mockBarramento);
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });

    it('deve lançar EntityNotFoundException quando OS não existe', async () => {
      mockOsRepository.findOne.mockRejectedValue(
        new EntityNotFoundException('OrdemDeServico', 'invalid')
      );

      const uc = new AssumirOrdemServicoUseCase(mockOsRepository, mockBarramento);
      await expect(uc.execute('invalid')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('AnalisarVeiculoUseCase', () => {
    it('deve emitir VeiculoAnalisado quando OS está UNDER_DIAGNOSIS', async () => {
      const osEmDiagnostico = makeOs({ status: 'UNDER_DIAGNOSIS' });
      mockOsRepository.findOne
        .mockResolvedValueOnce(osEmDiagnostico)
        .mockResolvedValueOnce(osEmDiagnostico);

      const uc = new AnalisarVeiculoUseCase(mockOsRepository, mockBarramento);
      await uc.execute('os-1');

      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
    });

    it('deve lançar DomainException quando OS não está UNDER_DIAGNOSIS', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new AnalisarVeiculoUseCase(mockOsRepository, mockBarramento);
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });
  });

  describe('ListarServicosInsumosNaOsUseCase', () => {
    it('deve emitir ServicosEInsumosListados e retornar orçamento', async () => {
      const osEmDiagnostico = makeOs({ status: 'UNDER_DIAGNOSIS' });
      mockOsRepository.findOne.mockResolvedValue(osEmDiagnostico);
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);

      const uc = new ListarServicosInsumosNaOsUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockOsPecaRepository,
        mockBarramento
      );
      const result = await uc.execute('os-1', { valor_total_servicos: 100, valor_total_pecas: 50 });

      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('PENDING');
    });

    it('deve lançar DomainException quando OS está em status inválido', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new ListarServicosInsumosNaOsUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockOsPecaRepository,
        mockBarramento
      );
      await expect(
        uc.execute('os-1', { valor_total_servicos: 100, valor_total_pecas: 50 })
      ).rejects.toThrow(DomainException);
    });
  });

  describe('AtualizarOrdemServicoUseCase', () => {
    it('deve atualizar a OS quando estiver até AWAITING_APPROVAL', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOsRepository.update.mockResolvedValue({
        ...mockOs,
        status: 'AWAITING_APPROVAL',
        descricao: 'Nova descrição',
      });

      const uc = new AtualizarOrdemServicoUseCase(mockOsRepository);
      const result = await uc.execute('os-1', {
        descricao: 'Nova descrição',
        status: 'AWAITING_APPROVAL',
      });

      expect(mockOsRepository.update).toHaveBeenCalledWith('os-1', {
        descricao: 'Nova descrição',
        status: 'AWAITING_APPROVAL',
      });
      expect(result.descricao).toBe('Nova descrição');
    });

    it('deve bloquear atualização quando a OS já entrou em execução', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'IN_PROGRESS' }));

      const uc = new AtualizarOrdemServicoUseCase(mockOsRepository);

      await expect(
        uc.execute('os-1', { descricao: 'Tentativa de edição', status: 'AWAITING_APPROVAL' })
      ).rejects.toThrow(DomainException);
      expect(mockOsRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('AprovarOrcamentoUseCase', () => {
    it('deve aprovar orçamento pendente e emitir OrcamentoAprovado', async () => {
      const orcamentoAprovado = { ...mockOrcamento, status: 'APPROVED' as const };
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockOrcamentoRepository.update.mockResolvedValue(orcamentoAprovado);

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      const result = await uc.execute('os-1');

      expect(mockOrcamentoRepository.update).toHaveBeenCalledWith('orc-1', { status: 'APPROVED' });
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('APPROVED');
    });

    it('deve lançar EntityNotFoundException quando OS não encontrada', async () => {
      mockOsRepository.findOne.mockRejectedValue(
        new EntityNotFoundException('OrdemDeServico', 'invalid')
      );

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('invalid')).rejects.toThrow(EntityNotFoundException);
    });

    it('deve lançar DomainException quando orçamento não está PENDING', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        status: 'REJECTED',
      });

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });

    it('deve lançar EntityNotFoundException quando orçamento não existe', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(null);

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('os-1')).rejects.toThrow(EntityNotFoundException);
    });

    it('deve lançar DomainException quando valor_total_geral é zero', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        valor_total_geral: 0,
      });

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });

    it('deve lançar DomainException quando valor_total_geral é negativo', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        valor_total_geral: -10,
      });

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });
  });

  describe('RecusarOrcamentoUseCase', () => {
    it('deve recusar orçamento pendente e emitir OrcamentoRecusado', async () => {
      const orcamentoRecusado = { ...mockOrcamento, status: 'REJECTED' as const };
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockOrcamentoRepository.update.mockResolvedValue(orcamentoRecusado);

      const uc = new RecusarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      const result = await uc.execute('os-1');

      expect(mockOrcamentoRepository.update).toHaveBeenCalledWith('orc-1', { status: 'REJECTED' });
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('REJECTED');
    });

    it('deve lançar DomainException quando orçamento não está PENDING', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        status: 'APPROVED',
      });

      const uc = new RecusarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });

    it('deve lançar EntityNotFoundException quando orçamento não existe', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(null);

      const uc = new RecusarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento
      );
      await expect(uc.execute('os-1')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('FinalizarExecucaoUseCase', () => {
    it('deve emitir ServicoConcluidoPeloMecanico quando OS está IN_PROGRESS', async () => {
      const osEmExecucao = makeOs({ status: 'IN_PROGRESS' });
      const osFinalizada = makeOs({ status: 'FINISHED' });
      mockOsRepository.findOne
        .mockResolvedValueOnce(osEmExecucao)
        .mockResolvedValueOnce(osFinalizada);

      const uc = new FinalizarExecucaoUseCase(mockOsRepository, mockBarramento);
      const result = await uc.execute('os-1');

      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('FINISHED');
    });

    it('deve lançar DomainException quando OS não está IN_PROGRESS', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new FinalizarExecucaoUseCase(mockOsRepository, mockBarramento);
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });
  });

  describe('AprovarServicoPrestadoUseCase', () => {
    it('deve emitir ServicoAprovadoPeloCliente quando OS está FINISHED e manter o status', async () => {
      const osFinalizada = makeOs({ status: 'FINISHED' });
      mockOsRepository.findOne
        .mockResolvedValueOnce(osFinalizada)
        .mockResolvedValueOnce(osFinalizada);

      const uc = new AprovarServicoPrestadoUseCase(mockOsRepository, mockBarramento);
      const result = await uc.execute('os-1');

      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('FINISHED');
    });

    it('deve lançar DomainException quando OS não está FINISHED', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new AprovarServicoPrestadoUseCase(mockOsRepository, mockBarramento);
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });
  });

  describe('RegistrarEntregaVeiculoUseCase', () => {
    it('deve emitir PagamentoRegistrado e retornar a OS entregue', async () => {
      const osFinalizada = makeOs({ status: 'FINISHED' });
      const osEntregue = makeOs({ status: 'DELIVERED' });
      mockOsRepository.findOne
        .mockResolvedValueOnce(osFinalizada)
        .mockResolvedValueOnce(osEntregue);

      const uc = new RegistrarEntregaVeiculoUseCase(mockOsRepository, mockBarramento);
      const result = await uc.execute('os-1');

      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('DELIVERED');
    });

    it('deve lançar DomainException quando OS não está FINISHED', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new RegistrarEntregaVeiculoUseCase(mockOsRepository, mockBarramento);
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });
  });

  describe('ConsultarStatusOrdemServicoUseCase', () => {
    it('deve retornar id e status da OS', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new ConsultarStatusOrdemServicoUseCase(mockOsRepository);
      const result = await uc.execute('os-1');

      expect(result).toEqual({ ordemServicoId: 'os-1', status: 'RECEIVED' });
    });

    it('deve lançar EntityNotFoundException quando OS não existe', async () => {
      mockOsRepository.findOne.mockRejectedValue(
        new EntityNotFoundException('OrdemDeServico', 'invalid')
      );

      const uc = new ConsultarStatusOrdemServicoUseCase(mockOsRepository);
      await expect(uc.execute('invalid')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('ListarOrdensServicoUseCase', () => {
    it('deve delegar para o repositório e retornar lista paginada', async () => {
      const paginado = {
        data: [mockOs],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockOsRepository.findAll.mockResolvedValue(paginado);

      const uc = new ListarOrdensServicoUseCase(mockOsRepository);
      const result = await uc.execute(1, 10, 'troca');

      expect(mockOsRepository.findAll).toHaveBeenCalledWith(1, 10, 'troca');
      expect(result).toBe(paginado);
    });

    it('deve retornar OS recusada sem filtrar status CLOSED_WITHOUT_EXECUTION', async () => {
      const osRecusada = makeOs({ status: 'CLOSED_WITHOUT_EXECUTION' });
      const paginado = {
        data: [osRecusada],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockOsRepository.findAll.mockResolvedValue(paginado);

      const uc = new ListarOrdensServicoUseCase(mockOsRepository);
      const result = await uc.execute(1, 10);

      expect(mockOsRepository.findAll).toHaveBeenCalledWith(1, 10, undefined);
      expect(result.data[0].status).toBe('CLOSED_WITHOUT_EXECUTION');
    });
  });

  describe('DetalharOrdemServicoUseCase', () => {
    it('deve retornar OS pelo ID', async () => {
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new DetalharOrdemServicoUseCase(mockOsRepository);
      const result = await uc.execute('os-1');

      expect(mockOsRepository.findOne).toHaveBeenCalledWith('os-1');
      expect(result).toBe(mockOs);
    });
  });

  describe('DeletarOrdemServicoUseCase', () => {
    it('deve deletar e retornar a OS removida', async () => {
      mockOsRepository.remove.mockResolvedValue(mockOs);

      const uc = new DeletarOrdemServicoUseCase(mockOsRepository);
      const result = await uc.execute('os-1');

      expect(mockOsRepository.remove).toHaveBeenCalledWith('os-1');
      expect(result).toBe(mockOs);
    });
  });
});
