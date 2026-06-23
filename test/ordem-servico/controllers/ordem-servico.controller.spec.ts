import { Test, TestingModule } from '@nestjs/testing';
import { OrdemServicoController } from '../../../src/modules/ordem-servico/presentation/controllers/ordem-servico.controller';
import {
  CreateOrdemServicoDto,
  UpdateOrdemServicoDto,
  ListQueryDto,
  GerarOrcamentoDto,
} from '../../../src/modules/ordem-servico/presentation/dto/ordem-servico.dto';
import { Role } from '../../../src/auth/enums/role.enum';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
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
} from '../../../src/modules/ordem-servico/application/use-cases/ordem-servico.use-cases';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../../../src/modules/ordem-servico/application/use-cases/orcamento.use-cases';
import { ConsultarTempoMedioExecucaoUseCase } from '../../../src/modules/ordem-servico/application/use-cases/tempo-medio-execucao.use-case';

describe('OrdemServicoController', () => {
  let controller: OrdemServicoController;
  let criarUseCase: jest.Mocked<CriarOrdemServicoUseCase>;
  let assumirUseCase: jest.Mocked<AssumirOrdemServicoUseCase>;
  let analisarVeiculoUseCase: jest.Mocked<AnalisarVeiculoUseCase>;
  let listarServicosInsumosUseCase: jest.Mocked<ListarServicosInsumosNaOsUseCase>;
  let atualizarOrdemServicoUseCase: jest.Mocked<AtualizarOrdemServicoUseCase>;
  let aprovarOrcamentoUseCase: jest.Mocked<AprovarOrcamentoUseCase>;
  let recusarOrcamentoUseCase: jest.Mocked<RecusarOrcamentoUseCase>;
  let finalizarExecucaoUseCase: jest.Mocked<FinalizarExecucaoUseCase>;
  let aprovarServicoPrestadoUseCase: jest.Mocked<AprovarServicoPrestadoUseCase>;
  let registrarEntregaVeiculoUseCase: jest.Mocked<RegistrarEntregaVeiculoUseCase>;
  let consultarStatusUseCase: jest.Mocked<ConsultarStatusOrdemServicoUseCase>;
  let listarUseCase: jest.Mocked<ListarOrdensServicoUseCase>;
  let detalharUseCase: jest.Mocked<DetalharOrdemServicoUseCase>;
  let deletarUseCase: jest.Mocked<DeletarOrdemServicoUseCase>;
  let tempoMedioExecucaoUseCase: jest.Mocked<ConsultarTempoMedioExecucaoUseCase>;

  const mockUseCases = {
    criarUseCase: { execute: jest.fn() },
    assumirUseCase: { execute: jest.fn() },
    analisarVeiculoUseCase: { execute: jest.fn() },
    listarServicosInsumosUseCase: { execute: jest.fn() },
    atualizarOrdemServicoUseCase: { execute: jest.fn() },
    aprovarOrcamentoUseCase: { execute: jest.fn() },
    recusarOrcamentoUseCase: { execute: jest.fn() },
    finalizarExecucaoUseCase: { execute: jest.fn() },
    aprovarServicoPrestadoUseCase: { execute: jest.fn() },
    registrarEntregaVeiculoUseCase: { execute: jest.fn() },
    consultarStatusUseCase: { execute: jest.fn() },
    listarUseCase: { execute: jest.fn() },
    detalharUseCase: { execute: jest.fn() },
    deletarUseCase: { execute: jest.fn() },
    tempoMedioExecucaoUseCase: { execute: jest.fn() },
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockRolesGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdemServicoController],
      providers: [
        { provide: CriarOrdemServicoUseCase, useValue: mockUseCases.criarUseCase },
        { provide: AssumirOrdemServicoUseCase, useValue: mockUseCases.assumirUseCase },
        { provide: AnalisarVeiculoUseCase, useValue: mockUseCases.analisarVeiculoUseCase },
        {
          provide: ListarServicosInsumosNaOsUseCase,
          useValue: mockUseCases.listarServicosInsumosUseCase,
        },
        {
          provide: AtualizarOrdemServicoUseCase,
          useValue: mockUseCases.atualizarOrdemServicoUseCase,
        },
        { provide: AprovarOrcamentoUseCase, useValue: mockUseCases.aprovarOrcamentoUseCase },
        { provide: RecusarOrcamentoUseCase, useValue: mockUseCases.recusarOrcamentoUseCase },
        { provide: FinalizarExecucaoUseCase, useValue: mockUseCases.finalizarExecucaoUseCase },
        {
          provide: AprovarServicoPrestadoUseCase,
          useValue: mockUseCases.aprovarServicoPrestadoUseCase,
        },
        {
          provide: RegistrarEntregaVeiculoUseCase,
          useValue: mockUseCases.registrarEntregaVeiculoUseCase,
        },
        {
          provide: ConsultarStatusOrdemServicoUseCase,
          useValue: mockUseCases.consultarStatusUseCase,
        },
        { provide: ListarOrdensServicoUseCase, useValue: mockUseCases.listarUseCase },
        { provide: DetalharOrdemServicoUseCase, useValue: mockUseCases.detalharUseCase },
        { provide: DeletarOrdemServicoUseCase, useValue: mockUseCases.deletarUseCase },
        {
          provide: ConsultarTempoMedioExecucaoUseCase,
          useValue: mockUseCases.tempoMedioExecucaoUseCase,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<OrdemServicoController>(OrdemServicoController);
    criarUseCase = module.get(CriarOrdemServicoUseCase);
    assumirUseCase = module.get(AssumirOrdemServicoUseCase);
    analisarVeiculoUseCase = module.get(AnalisarVeiculoUseCase);
    listarServicosInsumosUseCase = module.get(ListarServicosInsumosNaOsUseCase);
    atualizarOrdemServicoUseCase = module.get(AtualizarOrdemServicoUseCase);
    aprovarOrcamentoUseCase = module.get(AprovarOrcamentoUseCase);
    recusarOrcamentoUseCase = module.get(RecusarOrcamentoUseCase);
    finalizarExecucaoUseCase = module.get(FinalizarExecucaoUseCase);
    aprovarServicoPrestadoUseCase = module.get(AprovarServicoPrestadoUseCase);
    registrarEntregaVeiculoUseCase = module.get(RegistrarEntregaVeiculoUseCase);
    consultarStatusUseCase = module.get(ConsultarStatusOrdemServicoUseCase);
    listarUseCase = module.get(ListarOrdensServicoUseCase);
    detalharUseCase = module.get(DetalharOrdemServicoUseCase);
    deletarUseCase = module.get(DeletarOrdemServicoUseCase);
    tempoMedioExecucaoUseCase = module.get(ConsultarTempoMedioExecucaoUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('criar', () => {
    const createDto: CreateOrdemServicoDto = {
      veiculoId: 'veiculo-1',
      clienteId: 'cliente-1',
      descricao: 'Troca de óleo',
    };

    const resultadoEsperado = {
      id: 'os-1',
      veiculoId: 'veiculo-1',
      clienteId: 'cliente-1',
      descricao: 'Troca de óleo',
      status: 'RECEIVED',
    };

    it('deve criar ordem de serviço com sucesso', async () => {
      criarUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.criar(createDto);

      expect(criarUseCase.execute).toHaveBeenCalledWith(createDto);
      expect(resultado).toEqual(resultadoEsperado);
    });

    it('deve tratar erros de criação', async () => {
      const erro = new Error('Veículo não encontrado');
      criarUseCase.execute.mockRejectedValue(erro);

      await expect(controller.criar(createDto)).rejects.toThrow(erro);
    });
  });

  describe('listar', () => {
    const query: ListQueryDto = { page: 1, limit: 10, search: 'troca' };
    const resultadoEsperado = {
      data: [{ id: 'os-1', descricao: 'Troca de óleo' }],
      total: 1,
      page: 1,
      limit: 10,
    };

    it('deve listar ordens de serviço ativas com paginação', async () => {
      listarUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.listar(query);

      expect(listarUseCase.execute).toHaveBeenCalledWith(1, 10);
      expect(resultado).toEqual(resultadoEsperado);
    });

    it('deve usar valores padrão de paginação', async () => {
      listarUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.listar({});

      expect(listarUseCase.execute).toHaveBeenCalledWith(1, 10);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('detalhar', () => {
    const osId = 'os-1';
    const resultadoEsperado = {
      id: 'os-1',
      descricao: 'Troca de óleo',
      status: 'RECEIVED',
    };

    it('deve obter detalhes da ordem de serviço', async () => {
      detalharUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.detalhar(osId, mockUser);

      expect(detalharUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('consultarStatus', () => {
    const osId = 'os-1';
    const resultadoEsperado = {
      id: 'os-1',
      status: 'RECEIVED',
      descricao: 'Troca de óleo',
    };

    it('deve obter status da ordem de serviço', async () => {
      consultarStatusUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.consultarStatus(osId);

      expect(consultarStatusUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('atualizar', () => {
    const osId = 'os-1';
    const updateDto: UpdateOrdemServicoDto = {
      status: 'UNDER_DIAGNOSIS',
      descricao: 'Diagnóstico iniciado',
    };

    it('deve atualizar ordem de serviço', async () => {
      const resultadoEsperado = { id: osId, ...updateDto };
      atualizarOrdemServicoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.atualizar(osId, updateDto);

      expect(atualizarOrdemServicoUseCase.execute).toHaveBeenCalledWith(osId, updateDto);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('deletar', () => {
    const osId = 'os-1';

    it('deve deletar ordem de serviço', async () => {
      deletarUseCase.execute.mockResolvedValue({ sucesso: true });

      const resultado = await controller.deletar(osId);

      expect(deletarUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual({ sucesso: true });
    });
  });

  describe('assumir', () => {
    const osId = 'os-1';

    it('deve assumir ordem de serviço', async () => {
      const resultadoEsperado = { id: osId, status: 'UNDER_DIAGNOSIS' };
      assumirUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.assumir(osId);

      expect(assumirUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('analisarVeiculo', () => {
    const osId = 'os-1';

    it('deve analisar veículo', async () => {
      const resultadoEsperado = { id: osId, analiseRealizada: true };
      analisarVeiculoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.analisarVeiculo(osId);

      expect(analisarVeiculoUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('listarServicosInsumos', () => {
    const osId = 'os-1';
    const gerarOrcamentoDto: GerarOrcamentoDto = {
      valor_total_servicos: 300.0,
      valor_total_pecas: 150.0,
      pecas: [
        {
          id_peca: 'peca-1',
          quantidade: 2,
          preco_unitario: 75.0,
        },
      ],
    };

    it('deve listar serviços e gerar orçamento', async () => {
      const resultadoEsperado = {
        id: osId,
        status: 'AWAITING_APPROVAL',
        orcamento: gerarOrcamentoDto,
      };
      listarServicosInsumosUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.listarServicosInsumos(osId, gerarOrcamentoDto);

      expect(listarServicosInsumosUseCase.execute).toHaveBeenCalledWith(osId, gerarOrcamentoDto);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('aprovarOrcamento', () => {
    const osId = 'os-1';

    it('deve aprovar orçamento', async () => {
      const resultadoEsperado = { id: osId, status: 'IN_PROGRESS' };
      aprovarOrcamentoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.aprovarOrcamento(osId);

      expect(aprovarOrcamentoUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('recusarOrcamento', () => {
    const osId = 'os-1';

    it('deve recusar orçamento', async () => {
      const resultadoEsperado = { id: osId, status: 'CLOSED_WITHOUT_EXECUTION' };
      recusarOrcamentoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.recusarOrcamento(osId);

      expect(recusarOrcamentoUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('finalizarExecucao', () => {
    const osId = 'os-1';

    it('deve finalizar execução', async () => {
      const resultadoEsperado = { id: osId, status: 'FINISHED' };
      finalizarExecucaoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.finalizarExecucao(osId);

      expect(finalizarExecucaoUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('aprovarServicoPrestado', () => {
    const osId = 'os-1';

    it('deve aprovar serviço prestado', async () => {
      const resultadoEsperado = { id: osId, servicoAprovado: true };
      aprovarServicoPrestadoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.aprovarServicoPrestado(osId);

      expect(aprovarServicoPrestadoUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('registrarEntrega', () => {
    const osId = 'os-1';

    it('deve registrar entrega', async () => {
      const resultadoEsperado = { id: osId, status: 'DELIVERED' };
      registrarEntregaVeiculoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.registrarEntrega(osId);

      expect(registrarEntregaVeiculoUseCase.execute).toHaveBeenCalledWith(osId);
      expect(resultado).toEqual(resultadoEsperado);
    });
  });

  describe('tempoMedioExecucao', () => {
    it('deve retornar tempo médio de execução', async () => {
      const resultadoEsperado = { tempoMedioMinutos: 90, totalOrdensConsideradas: 5 };
      tempoMedioExecucaoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.tempoMedioExecucao();

      expect(tempoMedioExecucaoUseCase.execute).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual(resultadoEsperado);
    });

    it('deve retornar zero quando não há ordens finalizadas', async () => {
      const resultadoEsperado = { tempoMedioMinutos: 0, totalOrdensConsideradas: 0 };
      tempoMedioExecucaoUseCase.execute.mockResolvedValue(resultadoEsperado);

      const resultado = await controller.tempoMedioExecucao();

      expect(resultado).toEqual(resultadoEsperado);
    });

    it('deve propagar erros do use case', async () => {
      tempoMedioExecucaoUseCase.execute.mockRejectedValue(new Error('DB error'));

      await expect(controller.tempoMedioExecucao()).rejects.toThrow('DB error');
    });
  });

  describe('tratamento de erros', () => {
    it('deve propagar erros dos use cases', async () => {
      const erro = new Error('Erro no banco de dados');
      criarUseCase.execute.mockRejectedValue(erro);

      const createDto: CreateOrdemServicoDto = {
        veiculoId: 'veiculo-1',
        clienteId: 'cliente-1',
      };

      await expect(controller.criar(createDto)).rejects.toThrow('Erro no banco de dados');
    });
  });

  describe('configuração do controller', () => {
    it('deve ter metadados corretos do controller', () => {
      const controllerMetadata = Reflect.getMetadata('path', OrdemServicoController);
      expect(controllerMetadata).toBe('ordens-servico');
    });

    it('deve estar instanciado corretamente com todos os use cases', () => {
      expect(controller).toBeInstanceOf(OrdemServicoController);
      expect(criarUseCase).toBeDefined();
      expect(assumirUseCase).toBeDefined();
      expect(analisarVeiculoUseCase).toBeDefined();
      expect(listarServicosInsumosUseCase).toBeDefined();
      expect(atualizarOrdemServicoUseCase).toBeDefined();
      expect(aprovarOrcamentoUseCase).toBeDefined();
      expect(recusarOrcamentoUseCase).toBeDefined();
      expect(finalizarExecucaoUseCase).toBeDefined();
      expect(aprovarServicoPrestadoUseCase).toBeDefined();
      expect(registrarEntregaVeiculoUseCase).toBeDefined();
      expect(consultarStatusUseCase).toBeDefined();
      expect(listarUseCase).toBeDefined();
      expect(detalharUseCase).toBeDefined();
      expect(deletarUseCase).toBeDefined();
      expect(tempoMedioExecucaoUseCase).toBeDefined();
    });
  });
});
