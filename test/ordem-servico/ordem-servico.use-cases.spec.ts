import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';
import { ConflitoException } from '../../src/shared/domain/exceptions/conflito.exception';
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
import type { UpdateServiceOrderStatusUseCase } from '../../src/modules/ordem-servico/application/use-cases/update-service-order-status.use-case';
import { OrdemServicoCriada } from '../../src/modules/ordem-servico/domain/events/ordem-servico-criada.event';
import { OrdemServicoRecebida } from '../../src/modules/ordem-servico/domain/events/ordem-servico-recebida.event';
import { OrcamentoCalculado } from '../../src/modules/ordem-servico/domain/events/orcamento-calculado.event';
import type { IOrdemServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/ordem-servico.interface';
import type { IOsPecaRepository } from '../../src/modules/ordem-servico/domain/interfaces/os-peca.interface';
import type { IClienteRepository } from '../../src/modules/cadastro/domain/interfaces/cliente.interface';
import type { IVeiculoRepository } from '../../src/modules/cadastro/domain/interfaces/veiculo.interface';
import type { IServicoRepository } from '../../src/modules/cadastro/domain/interfaces/servico.interface';
import type { IPecaInsumoRepository } from '../../src/modules/pecas-insumos/domain/interfaces/peca-insumo.interface';
import type { IOsServicoRepository } from '../../src/modules/ordem-servico/domain/interfaces/os-servico.interface';
import type { IOsReadModelQuery } from '../../src/modules/ordem-servico/domain/interfaces/os-read-model.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { Cliente } from '../../src/modules/cadastro/domain/entities/cliente.entity';
import type { Veiculo } from '../../src/modules/cadastro/domain/entities/veiculo.entity';
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

describe('OS Use Cases', () => {
  let mockOsRepository: jest.Mocked<IOrdemServicoRepository>;
  let mockClienteRepository: jest.Mocked<IClienteRepository>;
  let mockVeiculoRepository: jest.Mocked<IVeiculoRepository>;
  let mockServicoRepository: jest.Mocked<IServicoRepository>;
  let mockPecaInsumoRepository: jest.Mocked<IPecaInsumoRepository>;
  let mockOsServicoRepository: jest.Mocked<IOsServicoRepository>;
  let mockOsPecaRepository: jest.Mocked<IOsPecaRepository>;
  let mockBarramento: jest.Mocked<EmissorEventos>;

  const mockOs = makeOs();

  beforeEach(() => {
    mockOsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      atualizarSeCondicao: jest.fn(),
      remove: jest.fn(),
      calcularTempoMedioExecucao: jest.fn(),
      findParadasAguardandoAprovacao: jest.fn(),
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
      debitarEstoqueAtomico: jest.fn(),
      remove: jest.fn(),
    };
    mockOsServicoRepository = {
      replaceAll: jest.fn(),
      findByOrdemServicoId: jest.fn(),
    };
    mockOsPecaRepository = {
      replaceAll: jest.fn(),
      findByOrdemServicoId: jest.fn(),
    } as jest.Mocked<IOsPecaRepository>;
    mockBarramento = {
      emitir: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmissorEventos>;
  });

  describe('CriarOrdemServicoUseCase', () => {
    it('deve criar OS e emitir OrdemServicoCriada e OrdemServicoRecebida (entrada na fila do Execução)', async () => {
      mockClienteRepository.findByDocumento.mockResolvedValue({
        id: 'cli-1',
      } as unknown as Cliente);
      mockVeiculoRepository.findByPlaca.mockResolvedValue({
        id: 'veh-1',
        clienteId: 'cli-1',
      } as unknown as Veiculo);
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
      expect(mockBarramento.emitir).toHaveBeenCalledTimes(2);
      expect(mockBarramento.emitir.mock.calls[0][0]).toBeInstanceOf(OrdemServicoCriada);
      expect(mockBarramento.emitir.mock.calls[1][0]).toBeInstanceOf(OrdemServicoRecebida);
      expect(mockBarramento.emitir.mock.calls[1][0]).toMatchObject({ ordemServicoId: 'os-1' });
      expect(result.id).toBe('os-1');
    });

    it('recusa com ConflitoException a placa de um veículo de outro cliente (#378, item 6)', async () => {
      mockClienteRepository.findByDocumento.mockResolvedValue({ id: 'cli-1' } as any);
      mockVeiculoRepository.findByPlaca.mockResolvedValue({
        id: 'veh-9',
        clienteId: 'cli-9',
      } as any);

      const uc = new CriarOrdemServicoUseCase(
        mockOsRepository,
        mockClienteRepository,
        mockVeiculoRepository,
        mockServicoRepository,
        mockPecaInsumoRepository,
        mockOsServicoRepository,
        mockOsPecaRepository,
        mockBarramento
      );

      await expect(
        uc.execute({
          cliente: { nome: 'Joao', email: 'joao@a.com', documento: '123', tipoDocumento: 'CPF' },
          veiculo: { placa: 'ABC1234', marca: 'Ford', modelo: 'Ka', ano: 2020 },
          servicos: [],
          pecas: [],
        })
      ).rejects.toThrow(ConflitoException);
      expect(mockOsRepository.create).not.toHaveBeenCalled();
      expect(mockBarramento.emitir).not.toHaveBeenCalled();
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
    const makeAtualizarStatus = () =>
      ({ execute: jest.fn() }) as unknown as jest.Mocked<UpdateServiceOrderStatusUseCase>;

    it('deve gravar DELIVERED pelo caso de uso de status, sem evento de pagamento', async () => {
      const osEntregue = makeOs({ status: 'DELIVERED' });
      mockOsRepository.findOne.mockResolvedValue(makeOs({ status: 'FINISHED' }));
      const atualizarStatus = makeAtualizarStatus();
      atualizarStatus.execute.mockResolvedValue(osEntregue);

      const uc = new RegistrarEntregaVeiculoUseCase(mockOsRepository, atualizarStatus);
      const result = await uc.execute('os-1');

      expect(atualizarStatus.execute).toHaveBeenCalledWith('os-1', 'DELIVERED');
      expect(mockBarramento.emitir).not.toHaveBeenCalled();
      expect(result).toBe(osEntregue);
    });

    it.each<OSStatus>(['IN_PROGRESS', 'AWAITING_APPROVAL', 'DELIVERED'])(
      'deve rejeitar a entrega quando a OS está %s',
      async (status) => {
        mockOsRepository.findOne.mockResolvedValue(makeOs({ status }));
        const atualizarStatus = makeAtualizarStatus();

        const uc = new RegistrarEntregaVeiculoUseCase(mockOsRepository, atualizarStatus);
        await expect(uc.execute('os-1')).rejects.toThrow(DomainException);
        expect(atualizarStatus.execute).not.toHaveBeenCalled();
      }
    );
  });

  describe('leituras pelo read model', () => {
    const leitura = {
      id: 'os-1',
      clienteId: 'cli-1',
      veiculoId: 'vei-1',
      status: 'RECEIVED' as const,
      descricao: null,
      iniciada_em: null,
      finalizada_em: null,
      entregue_em: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
      cliente: { id: 'cli-1', nome: 'Cliente', documento: '12345678909' },
      veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
    };
    let readModel: jest.Mocked<IOsReadModelQuery>;

    beforeEach(() => {
      readModel = { listarFila: jest.fn(), detalhar: jest.fn(), consultarStatus: jest.fn() };
    });

    it('ConsultarStatus devolve status e marcos do read model', async () => {
      const status = {
        ordemServicoId: 'os-1',
        status: 'RECEIVED' as const,
        marcos: {
          createdAt: leitura.created_at,
          iniciadaEm: null,
          finalizadaEm: null,
          entregueEm: null,
        },
      };
      readModel.consultarStatus.mockResolvedValue(status);

      const result = await new ConsultarStatusOrdemServicoUseCase(readModel).execute('os-1');

      expect(result).toBe(status);
      expect(mockOsRepository.findOne).not.toHaveBeenCalled();
    });

    it('ConsultarStatus lança EntityNotFoundException quando não há documento', async () => {
      readModel.consultarStatus.mockResolvedValue(null);

      await expect(
        new ConsultarStatusOrdemServicoUseCase(readModel).execute('invalid')
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('Listar delega a fila paginada por cursor ao read model', async () => {
      const pagina = { data: [leitura], pagination: { limit: 10, nextCursor: null } };
      readModel.listarFila.mockResolvedValue(pagina);

      const result = await new ListarOrdensServicoUseCase(readModel).execute(10, 'cursor-1');

      expect(readModel.listarFila).toHaveBeenCalledWith(10, 'cursor-1');
      expect(result).toBe(pagina);
    });

    it('Detalhar devolve o documento do read model', async () => {
      readModel.detalhar.mockResolvedValue(leitura);

      const result = await new DetalharOrdemServicoUseCase(readModel).execute('os-1');

      expect(readModel.detalhar).toHaveBeenCalledWith('os-1');
      expect(result).toBe(leitura);
    });

    it('Detalhar lança EntityNotFoundException quando não há documento', async () => {
      readModel.detalhar.mockResolvedValue(null);

      await expect(new DetalharOrdemServicoUseCase(readModel).execute('x')).rejects.toThrow(
        EntityNotFoundException
      );
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
