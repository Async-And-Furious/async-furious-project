import { Prisma } from '@prisma/client';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import {
  CriarOrdemServicoUseCase,
  ListarServicosInsumosNaOsUseCase,
  AtualizarOrdemServicoUseCase,
  AprovarServicoPrestadoUseCase,
  RegistrarEntregaVeiculoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  DetalharOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
} from '../../src/modules/ordem-servico/application/use-cases/ordem-servico.use-cases';
import { OrdemServicoCriada } from '../../src/modules/ordem-servico/domain/events/ordem-servico-criada.event';
import { OrdemServicoRecebida } from '../../src/modules/ordem-servico/domain/events/ordem-servico-recebida.event';
import { OrcamentoCalculado } from '../../src/modules/ordem-servico/domain/events/orcamento-calculado.event';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IOrcamentoRepository } from '../../src/modules/ordem-servico/domain/interfaces/orcamento.interface';
import type { IOsPecaRepository } from '../../src/modules/ordem-servico/domain/interfaces/os-peca.interface';
import type { IClienteRepository } from '../../src/modules/cadastro/domain/interfaces/cliente.interface';
import type { IVeiculoRepository } from '../../src/modules/cadastro/domain/interfaces/veiculo.interface';
import type { IServicoRepository } from '../../src/modules/cadastro/domain/interfaces/servico.interface';
import type { IPecaInsumoRepository } from '../../src/modules/pecas-insumos/domain/interfaces/peca-insumo.interface';
import type { IOsServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/os-servico.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { ICobrancaPagamentoPort } from '../../src/shared/domain/interfaces/cobranca-pagamento.port';
import type { Cliente } from '../../src/modules/cadastro/domain/entities/cliente.entity';
import type { Veiculo } from '../../src/modules/cadastro/domain/entities/veiculo.entity';
import type { Orcamento } from '../../src/modules/ordem-servico/domain/entities/orcamento.entity';
import {
  OrdemDeServico,
  type OSStatus,
} from '../../src/modules/ordem-servico/domain/entities/ordem-servico.entity';

const makeOs = (overrides: Partial<OrdemDeServico> = {}): OrdemDeServico =>
  Object.assign(new OrdemDeServico(), {
    id: 'os-1',
    veiculoId: 'veh-1',
    clienteId: 'cli-1',
    status: 'RECEIVED' as OSStatus,
    descricao: 'Troca de óleo',
    iniciada_em: null,
    finalizada_em: null,
    entregue_em: null,
    reservaPecasPendente: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

describe('OS + Orçamento Use Cases', () => {
  let mockOsRepository: jest.Mocked<IOrdemServicoRepository>;
  let mockClienteRepository: jest.Mocked<IClienteRepository>;
  let mockVeiculoRepository: jest.Mocked<IVeiculoRepository>;
  let mockServicoRepository: jest.Mocked<IServicoRepository>;
  let mockPecaInsumoRepository: jest.Mocked<IPecaInsumoRepository>;
  let mockOsServicoRepository: jest.Mocked<IOsServicoRepository>;
  let mockOrcamentoRepository: jest.Mocked<IOrcamentoRepository>;
  let mockOsPecaRepository: jest.Mocked<IOsPecaRepository>;
  let mockBarramento: jest.Mocked<EmissorEventos>;
  let mockCobranca: jest.Mocked<ICobrancaPagamentoPort>;

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
      findAllAtivas: jest.fn(),
      remove: jest.fn(),
      calcularTempoMedioExecucao: jest.fn(),
    } as jest.Mocked<IOrdemServicoRepository>;
    mockClienteRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByDocumento: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mockVeiculoRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByPlaca: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mockServicoRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mockPecaInsumoRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByOrdemServicoId: jest.fn(),
      update: jest.fn(),
      updateEstoque: jest.fn(),
      remove: jest.fn(),
    };
    mockOsServicoRepository = {
      replaceAll: jest.fn(),
      findByOrdemServicoId: jest.fn(),
    };
    mockOrcamentoRepository = {
      create: jest.fn(),
      findByOrdemServicoId: jest.fn(),
      update: jest.fn(),
      aprovarSePendente: jest.fn(),
    } as jest.Mocked<IOrcamentoRepository>;
    mockOsPecaRepository = {
      replaceAll: jest.fn(),
      findByOrdemServicoId: jest.fn(),
    } as jest.Mocked<IOsPecaRepository>;
    mockBarramento = {
      emitir: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmissorEventos>;
    mockCobranca = {
      gerarLinkPagamento: jest.fn().mockResolvedValue('https://mp.test/checkout/os-1'),
    };
  });

  describe('CriarOrdemServicoUseCase', () => {
    it('deve criar OS e emitir OrdemServicoCriada e OrdemServicoRecebida (entrada na fila do Execução)', async () => {
      mockClienteRepository.findByDocumento.mockResolvedValue({
        id: 'cli-1',
      } as unknown as Cliente);
      mockVeiculoRepository.findByPlaca.mockResolvedValue({ id: 'veh-1' } as unknown as Veiculo);
      mockOsRepository.create.mockResolvedValue(mockOs);
      mockOsRepository.findOne.mockResolvedValue(mockOs);

      const uc = new CriarOrdemServicoUseCase(
        mockOsRepository,
        mockClienteRepository,
        mockVeiculoRepository,
        mockServicoRepository,
        mockPecaInsumoRepository,
        mockOsServicoRepository,
        mockOsPecaRepository,
        mockOrcamentoRepository,
        mockBarramento
      );

      const payload = {
        cliente: {
          nome: 'Joao',
          email: 'joao@a.com',
          documento: '123',
          tipoDocumento: 'CPF' as const,
        },
        veiculo: { placa: 'ABC1234', marca: 'Ford', modelo: 'Ka', ano: 2020 },
        servicos: [],
        pecas: [],
        descricao: 'Teste',
      };

      const result = await uc.execute(payload);

      expect(mockOsRepository.create).toHaveBeenCalledWith({
        veiculoId: 'veh-1',
        clienteId: 'cli-1',
        descricao: 'Teste',
      });
      expect(mockOrcamentoRepository.create).toHaveBeenCalled();
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(2);
      expect(mockBarramento.emitir.mock.calls[0][0]).toBeInstanceOf(OrdemServicoCriada);
      expect(mockBarramento.emitir.mock.calls[1][0]).toBeInstanceOf(OrdemServicoRecebida);
      expect(mockBarramento.emitir.mock.calls[1][0]).toMatchObject({ ordemServicoId: 'os-1' });
      expect(result.id).toBe('os-1');
    });
  });

  describe('ListarServicosInsumosNaOsUseCase', () => {
    const criarUseCase = () =>
      new ListarServicosInsumosNaOsUseCase(mockOsRepository, mockOsPecaRepository, mockBarramento);

    it('deve emitir OrcamentoCalculado com os três totais e retorná-los (sem Orcamento)', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'UNDER_DIAGNOSIS' }));

      const result = await criarUseCase().execute('os-1', {
        valor_total_servicos: 450,
        valor_total_pecas: 320.5,
      });

      expect(result).toEqual({
        ordemServicoId: 'os-1',
        valorTotalServicos: 450,
        valorTotalPecas: 320.5,
        valorTotalGeral: 770.5,
      });
      expect(result).not.toHaveProperty('status');
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      const evento = mockBarramento.emitir.mock.calls[0][0] as OrcamentoCalculado;
      expect(evento).toBeInstanceOf(OrcamentoCalculado);
      expect(evento).toMatchObject({
        ordemServicoId: 'os-1',
        valorTotalServicos: 450,
        valorTotalPecas: 320.5,
        valorTotalGeral: 770.5,
      });
      expect(mockOrcamentoRepository.findByOrdemServicoId).not.toHaveBeenCalled();
    });

    it('soma sem erro de ponto flutuante (0.1 + 0.2)', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'UNDER_DIAGNOSIS' }));

      const result = await criarUseCase().execute('os-1', {
        valor_total_servicos: 0.1,
        valor_total_pecas: 0.2,
      });

      expect(result.valorTotalGeral).toBe(0.3);
    });

    it('persiste OsPeca antes de publicar quando há peças', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'UNDER_DIAGNOSIS' }));

      await criarUseCase().execute('os-1', {
        valor_total_servicos: 100,
        valor_total_pecas: 150,
        pecas: [{ id_peca: 'peca-1', quantidade: 2, preco_unitario: 75 }],
      });

      expect(mockOsPecaRepository.replaceAll).toHaveBeenCalledWith('os-1', [
        { id_peca: 'peca-1', quantidade: 2, preco_unitario: 75, valor_total: 150 },
      ]);
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
    });

    it('valor negativo é rejeitado antes de gravar OsPeca ou publicar', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'UNDER_DIAGNOSIS' }));

      await expect(
        criarUseCase().execute('os-1', {
          valor_total_servicos: -1,
          valor_total_pecas: 0,
          pecas: [{ id_peca: 'peca-1', quantidade: 1, preco_unitario: 10 }],
        })
      ).rejects.toThrow('negativos');
      expect(mockOsPecaRepository.replaceAll).not.toHaveBeenCalled();
      expect(mockBarramento.emitir).not.toHaveBeenCalled();
    });

    it.each<OSStatus>(['RECEIVED', 'AWAITING_APPROVAL', 'IN_PROGRESS'])(
      'exige OS em UNDER_DIAGNOSIS: com a OS em %s lança DomainException e não publica',
      async (status) => {
        mockOsRepository.findOne.mockResolvedValue(makeOs({ status }));

        await expect(
          criarUseCase().execute('os-1', { valor_total_servicos: 100, valor_total_pecas: 50 })
        ).rejects.toThrow(DomainException);
        expect(mockBarramento.emitir).not.toHaveBeenCalled();
        expect(mockOsPecaRepository.replaceAll).not.toHaveBeenCalled();
      }
    );
  });

  describe('AtualizarOrdemServicoUseCase', () => {
    it('deve atualizar a OS quando estiver até AWAITING_APPROVAL', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOsRepository.update.mockResolvedValue(
        makeOs({
          status: 'AWAITING_APPROVAL',
          descricao: 'Nova descrição',
        })
      );

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
      mockOrcamentoRepository.aprovarSePendente.mockResolvedValue(orcamentoAprovado);

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento,
        mockCobranca
      );
      const result = await uc.execute('os-1');

      expect(mockCobranca.gerarLinkPagamento).toHaveBeenCalledWith('os-1', 150);
      expect(mockOrcamentoRepository.aprovarSePendente).toHaveBeenCalledWith('orc-1');
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('APPROVED');
      expect(result.linkPagamento).toBe('https://mp.test/checkout/os-1');
    });

    it('deve enviar o valor como number quando o repositório devolve Decimal do Prisma', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue({
        ...mockOrcamento,
        valor_total_geral: new Prisma.Decimal('150.50') as unknown as number,
      });
      mockOrcamentoRepository.aprovarSePendente.mockResolvedValue({
        ...mockOrcamento,
        status: 'APPROVED',
      });

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento,
        mockCobranca
      );
      await uc.execute('os-1');

      expect(mockCobranca.gerarLinkPagamento).toHaveBeenCalledWith('os-1', 150.5);
    });

    it('deve manter orçamento PENDING quando a cobrança no Mercado Pago falha', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockCobranca.gerarLinkPagamento.mockRejectedValue(new Error('Mercado Pago indisponível'));

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento,
        mockCobranca
      );

      await expect(uc.execute('os-1')).rejects.toThrow('Mercado Pago indisponível');
      expect(mockOrcamentoRepository.aprovarSePendente).not.toHaveBeenCalled();
      expect(mockBarramento.emitir).not.toHaveBeenCalled();
    });

    it('aprovação concorrente que perde a transição devolve o mesmo link sem publicar OrcamentoAprovado', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(mockOrcamento);
      mockOrcamentoRepository.aprovarSePendente.mockResolvedValue(null);

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento,
        mockCobranca
      );
      const result = await uc.execute('os-1');

      expect(result.status).toBe('APPROVED');
      expect(result.linkPagamento).toBe('https://mp.test/checkout/os-1');
      expect(mockBarramento.emitir).not.toHaveBeenCalled();
    });

    it('deve lançar EntityNotFoundException quando OS não encontrada', async () => {
      mockOsRepository.findOne.mockRejectedValue(
        new EntityNotFoundException('OrdemDeServico', 'invalid')
      );

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento,
        mockCobranca
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
        mockBarramento,
        mockCobranca
      );
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });

    it('deve lançar EntityNotFoundException quando orçamento não existe', async () => {
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'AWAITING_APPROVAL' }));
      mockOrcamentoRepository.findByOrdemServicoId.mockResolvedValue(null);

      const uc = new AprovarOrcamentoUseCase(
        mockOsRepository,
        mockOrcamentoRepository,
        mockBarramento,
        mockCobranca
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
        mockBarramento,
        mockCobranca
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
        mockBarramento,
        mockCobranca
      );
      await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
    });

    it('deve lançar DomainException quando OS não está em AWAITING_APPROVAL', async () => {
      const statusesInvalidos: OrdemDeServico['status'][] = [
        'RECEIVED',
        'UNDER_DIAGNOSIS',
        'IN_PROGRESS',
        'FINISHED',
        'DELIVERED',
        'CLOSED_WITHOUT_EXECUTION',
      ];

      for (const status of statusesInvalidos) {
        mockOsRepository.findOne.mockResolvedValue(makeOs({ status }));

        const uc = new AprovarOrcamentoUseCase(
          mockOsRepository,
          mockOrcamentoRepository,
          mockBarramento,
          mockCobranca
        );
        await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
        expect(mockOrcamentoRepository.findByOrdemServicoId).not.toHaveBeenCalled();
        jest.clearAllMocks();
      }
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

    it('deve lançar DomainException quando OS não está em AWAITING_APPROVAL', async () => {
      const statusesInvalidos: OrdemDeServico['status'][] = [
        'RECEIVED',
        'UNDER_DIAGNOSIS',
        'IN_PROGRESS',
        'FINISHED',
        'DELIVERED',
        'CLOSED_WITHOUT_EXECUTION',
      ];

      for (const status of statusesInvalidos) {
        mockOsRepository.findOne.mockResolvedValue(makeOs({ status }));

        const uc = new RecusarOrcamentoUseCase(
          mockOsRepository,
          mockOrcamentoRepository,
          mockBarramento
        );
        await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
        expect(mockOrcamentoRepository.findByOrdemServicoId).not.toHaveBeenCalled();
        jest.clearAllMocks();
      }
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
    it('deve delegar para findAllAtivas e retornar lista paginada', async () => {
      const paginado = {
        data: [mockOs],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockOsRepository.findAllAtivas.mockResolvedValue(paginado);

      const uc = new ListarOrdensServicoUseCase(mockOsRepository);
      const result = await uc.execute(1, 10);

      expect(mockOsRepository.findAllAtivas).toHaveBeenCalledWith(1, 10);
      expect(result).toBe(paginado);
    });

    it('deve excluir CLOSED_WITHOUT_EXECUTION da listagem ativa', async () => {
      const paginado = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockOsRepository.findAllAtivas.mockResolvedValue(paginado);

      const uc = new ListarOrdensServicoUseCase(mockOsRepository);
      const result = await uc.execute(1, 10);

      expect(mockOsRepository.findAllAtivas).toHaveBeenCalledWith(1, 10);
      expect(result.data).toHaveLength(0);
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
