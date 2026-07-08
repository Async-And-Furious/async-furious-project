import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import { EntityNotFoundException } from '../../src/shared/domain/exceptions/entity-not-found.exception';
import { VerificarDisponibilidadeEstoqueHandler } from '../../src/modules/pecas-insumos/application/event-handlers/verificar-disponibilidade-estoque.handler';
import { DebitarEstoqueHandler } from '../../src/modules/pecas-insumos/application/event-handlers/debitar-estoque.handler';
import { NotificarPecasIndisponiveisHandler } from '../../src/modules/pecas-insumos/application/event-handlers/notificar-pecas-indisponiveis.handler';
import { NotificarAdminReposicaoHandler } from '../../src/modules/pecas-insumos/application/event-handlers/notificar-admin-reposicao.handler';
import { ValidarBacklogOrdensPendentesHandler } from '../../src/modules/pecas-insumos/application/event-handlers/validar-backlog-ordens-pendentes.handler';
import { LiberarOrdensAguardandoPecasHandler } from '../../src/modules/pecas-insumos/application/event-handlers/liberar-ordens-aguardando-pecas.handler';
import {
  SolicitarPecasAoFornecedorUseCase,
  ReceberPecasDoFornecedorUseCase,
} from '../../src/modules/pecas-insumos/application/use-cases/fornecedor.use-cases';
import { OrcamentoAprovadoComPecas } from '../../src/modules/ordem-servico/domain/events/orcamento-aprovado-com-pecas.event';
import { PecasEmEstoqueConfirmadas } from '../../src/modules/pecas-insumos/domain/events/pecas-em-estoque-confirmadas.event';
import { PecasNaoExistem } from '../../src/modules/pecas-insumos/domain/events/pecas-nao-existem.event';
import { PecasIndisponiveis } from '../../src/modules/pecas-insumos/domain/events/pecas-indisponiveis.event';
import { EstoqueDebitado } from '../../src/modules/pecas-insumos/domain/events/estoque-debitado.event';
import { PecasReservadas } from '../../src/modules/pecas-insumos/domain/events/pecas-reservadas.event';
import { EstoqueAtualizadoAposRecebimento } from '../../src/modules/pecas-insumos/domain/events/estoque-atualizado-apos-recebimento.event';
import { BacklogValidadoPecasDisponiveis } from '../../src/modules/pecas-insumos/domain/events/backlog-validado-pecas-disponiveis.event';
import type { IPecaInsumoRepository } from '../../src/modules/pecas-insumos/domain/interfaces/peca-insumo.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { PecaInsumo } from '../../src/modules/pecas-insumos/domain/entities/peca-insumo.entity';
import type { IOrdemServicoBacklogPort } from '../../src/shared/domain/interfaces/ordem-servico-backlog.port';
import { PecaInsumoRepository } from '../../src/modules/pecas-insumos/infrastructure/repositories/peca-insumo.repository';
import { ReservaEstoqueRepository } from '../../src/modules/pecas-insumos/infrastructure/repositories/reserva-estoque.repository';
import { PedidoFornecedorRepository } from '../../src/modules/pecas-insumos/infrastructure/repositories/pedido-fornecedor.repository';
import type { PedidoFornecedor } from '../../src/modules/pecas-insumos/domain/entities/pedido-fornecedor.entity';
import type { IFornecedorGateway } from '../../src/modules/pecas-insumos/application/ports/fornecedor.gateway';
import type { INotificacaoAdminGateway } from '../../src/modules/pecas-insumos/application/ports/notificacao-admin.gateway';

const mockPeca = (overrides: Partial<PecaInsumo> = {}): PecaInsumo => ({
  id: 'peca-1',
  nome: 'Filtro de Oleo',
  codigo: 'FLT-001',
  descricao: null,
  preco: 50,
  quantidade_estoque: 10,
  quantidade_minima: 2,
  receberDoFornecedor(quantidade: number): void {
    this.quantidade_estoque += quantidade;
  },
  podeAtenderReserva(quantidadeNecessaria: number): boolean {
    return this.quantidade_estoque >= quantidadeNecessaria;
  },
  debitarEstoque(quantidade: number): void {
    this.quantidade_estoque -= quantidade;
  },
  estaBelowMinimo(): boolean {
    return this.quantidade_estoque < this.quantidade_minima;
  },
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('PecasInsumos Event handlers', () => {
  let repo: jest.Mocked<IPecaInsumoRepository>;
  let emissor: jest.Mocked<EmissorEventos>;
  let backlogPort: jest.Mocked<IOrdemServicoBacklogPort>;
  let reservaRepo: jest.Mocked<ReservaEstoqueRepository>;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByOrdemServicoId: jest.fn(),
      update: jest.fn(),
      updateEstoque: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<IPecaInsumoRepository>;

    emissor = {
      emitir: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmissorEventos>;

    backlogPort = {
      findAllAguardandoPecas: jest.fn(),
    } as unknown as jest.Mocked<IOrdemServicoBacklogPort>;

    reservaRepo = {
      save: jest.fn(),
      existsByOrdemId: jest.fn(),
    } as unknown as jest.Mocked<ReservaEstoqueRepository>;
  });

  describe('VerificarDisponibilidadeEstoqueHandler (P-18)', () => {
    it('deve emitir PecasEmEstoqueConfirmadas quando todas as pecas estao disponiveis', async () => {
      const handler = new VerificarDisponibilidadeEstoqueHandler(repo, emissor);
      repo.findByOrdemServicoId.mockResolvedValue([
        {
          id_peca: 'peca-1',
          quantidade: 2,
          preco_unitario: 50,
          valor_total: 100,
          quantidade_estoque: 5,
          quantidade_minima: 1,
        },
      ]);

      await handler.handle(new OrcamentoAprovadoComPecas('os-1', 'orc-1'));

      expect(repo.findByOrdemServicoId).toHaveBeenCalledWith('os-1');
      expect(emissor.emitir).toHaveBeenCalledTimes(1);
      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: PecasEmEstoqueConfirmadas,
          ordemServicoId: 'os-1',
        })
      );
    });

    it('deve emitir PecasNaoExistem quando alguma peca nao tem estoque suficiente', async () => {
      const handler = new VerificarDisponibilidadeEstoqueHandler(repo, emissor);
      repo.findByOrdemServicoId.mockResolvedValue([
        {
          id_peca: 'peca-1',
          quantidade: 3,
          preco_unitario: 50,
          valor_total: 150,
          quantidade_estoque: 1,
          quantidade_minima: 1,
        },
      ]);

      await handler.handle(new OrcamentoAprovadoComPecas('os-1', 'orc-1'));

      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: PecasNaoExistem,
          ordemServicoId: 'os-1',
          idsPecasIndisponiveis: ['peca-1'],
        })
      );
    });
  });

  describe('DebitarEstoqueHandler (P-19)', () => {
    it('deve debitar estoque e emitir EstoqueDebitado e PecasReservadas', async () => {
      const handler = new DebitarEstoqueHandler(repo, emissor);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 10 }));
      repo.updateEstoque.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 7 }));

      const evento = new PecasEmEstoqueConfirmadas('os-1', [
        { id_peca: 'peca-1', quantidade: 3, preco_unitario: 50 },
      ]);

      await handler.handle(evento);

      expect(repo.findOne).toHaveBeenCalledWith('peca-1');
      expect(repo.updateEstoque).toHaveBeenCalledWith('peca-1', 7);
      expect(emissor.emitir).toHaveBeenCalledTimes(2);
      expect(emissor.emitir).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ constructor: EstoqueDebitado, ordemServicoId: 'os-1' })
      );
      expect(emissor.emitir).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ constructor: PecasReservadas, ordemServicoId: 'os-1' })
      );
    });
  });

  describe('NotificarPecasIndisponiveisHandler (P-20)', () => {
    it('deve emitir PecasIndisponiveis a partir de PecasNaoExistem', async () => {
      const handler = new NotificarPecasIndisponiveisHandler(emissor);

      await handler.handle(new PecasNaoExistem('os-1', ['peca-1', 'peca-2']));

      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: PecasIndisponiveis,
          ordemServicoId: 'os-1',
          idsPecasIndisponiveis: ['peca-1', 'peca-2'],
        })
      );
    });
  });

  describe('NotificarAdminReposicaoHandler (P-21)', () => {
    it('deve alertar gateway quando PecasIndisponiveis ocorrer', async () => {
      const mockGateway: jest.Mocked<INotificacaoAdminGateway> = {
        alertar: jest.fn().mockResolvedValue(undefined),
      };
      const handler = new NotificarAdminReposicaoHandler(mockGateway);

      await handler.handle(new PecasIndisponiveis('os-1', ['peca-1']));

      expect(mockGateway.alertar).toHaveBeenCalledWith({
        ordemServicoId: 'os-1',
        idsPecasIndisponiveis: ['peca-1'],
      });
    });
  });

  describe('ValidarBacklogOrdensPendentesHandler (P-22)', () => {
    it('deve emitir BacklogValidadoPecasDisponiveis quando estoque suporta a OS aguardando pecas', async () => {
      const handler = new ValidarBacklogOrdensPendentesHandler(
        backlogPort,
        repo as unknown as PecaInsumoRepository,
        emissor
      );
      backlogPort.findAllAguardandoPecas.mockResolvedValue([
        {
          ordemId: 'os-1',
          pecas: [{ pecaId: 'peca-1', quantidadeNecessaria: 2 }],
        },
      ]);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 5 }));

      await handler.handle(
        new EstoqueAtualizadoAposRecebimento([{ pecaId: 'peca-1', novaQuantidade: 3 }])
      );

      expect(backlogPort.findAllAguardandoPecas).toHaveBeenCalledTimes(1);
      const emitido = emissor.emitir.mock.calls[0][0] as BacklogValidadoPecasDisponiveis;
      expect(emitido).toBeInstanceOf(BacklogValidadoPecasDisponiveis);
      expect(emitido.ordemId).toBe('os-1');
    });

    it('nao deve emitir evento quando ainda faltar estoque para atender backlog', async () => {
      const handler = new ValidarBacklogOrdensPendentesHandler(
        backlogPort,
        repo as unknown as PecaInsumoRepository,
        emissor
      );
      backlogPort.findAllAguardandoPecas.mockResolvedValue([
        {
          ordemId: 'os-1',
          pecas: [{ pecaId: 'peca-1', quantidadeNecessaria: 6 }],
        },
      ]);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 2 }));

      await handler.handle(
        new EstoqueAtualizadoAposRecebimento([{ pecaId: 'peca-1', novaQuantidade: 2 }])
      );

      expect(backlogPort.findAllAguardandoPecas).toHaveBeenCalledTimes(1);
      expect(emissor.emitir).not.toHaveBeenCalled();
    });

    it('não deve emitir evento quando peca não for encontrada no estoque', async () => {
      const handler = new ValidarBacklogOrdensPendentesHandler(
        backlogPort,
        repo as unknown as PecaInsumoRepository,
        emissor
      );
      backlogPort.findAllAguardandoPecas.mockResolvedValue([
        {
          ordemId: 'os-1',
          pecas: [{ pecaId: 'peca-inexistente', quantidadeNecessaria: 1 }],
        },
      ]);
      repo.findOne.mockResolvedValue(null);

      await handler.handle(
        new EstoqueAtualizadoAposRecebimento([{ pecaId: 'peca-inexistente', novaQuantidade: 0 }])
      );

      expect(emissor.emitir).not.toHaveBeenCalled();
    });
  });

  describe('LiberarOrdensAguardandoPecasHandler (P-25)', () => {
    it('deve debitar, reservar e emitir PecasReservadas quando backlog estiver validado', async () => {
      const handler = new LiberarOrdensAguardandoPecasHandler(
        repo as unknown as PecaInsumoRepository,
        reservaRepo,
        emissor
      );

      reservaRepo.existsByOrdemId.mockResolvedValue(false);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 10 }));

      await handler.handle({
        ordemId: 'os-1',
        pecas: [{ pecaId: 'peca-1', quantidadeNecessaria: 3 }],
      });

      expect(repo.updateEstoque).toHaveBeenCalledWith('peca-1', 7);
      expect(reservaRepo.save).toHaveBeenCalledWith({
        ordem_id: 'os-1',
        peca_id: 'peca-1',
        quantidade: 3,
      });

      const emitido = emissor.emitir.mock.calls[0][0] as PecasReservadas;
      expect(emitido).toBeInstanceOf(PecasReservadas);
      expect(emitido.ordemServicoId).toBe('os-1');
    });

    it('nao deve executar novamente quando a ordem ja estiver reservada', async () => {
      const handler = new LiberarOrdensAguardandoPecasHandler(
        repo as unknown as PecaInsumoRepository,
        reservaRepo,
        emissor
      );

      reservaRepo.existsByOrdemId.mockResolvedValue(true);

      await handler.handle({
        ordemId: 'os-1',
        pecas: [{ pecaId: 'peca-1', quantidadeNecessaria: 1 }],
      });

      expect(repo.findOne).not.toHaveBeenCalled();
      expect(reservaRepo.save).not.toHaveBeenCalled();
      expect(emissor.emitir).not.toHaveBeenCalled();
    });

    it('deve throw NotFoundException quando peca nao for encontrada', async () => {
      const handler = new LiberarOrdensAguardandoPecasHandler(
        repo as unknown as PecaInsumoRepository,
        reservaRepo,
        emissor
      );

      reservaRepo.existsByOrdemId.mockResolvedValue(false);
      repo.findOne.mockResolvedValue(null);

      await expect(
        handler.handle({
          ordemId: 'os-1',
          pecas: [{ pecaId: 'peca-inexistente', quantidadeNecessaria: 1 }],
        })
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('SolicitarPecasAoFornecedorUseCase', () => {
    let pedidoFornecedorRepo: jest.Mocked<PedidoFornecedorRepository>;
    let mockFornecedorGateway: jest.Mocked<IFornecedorGateway>;

    beforeEach(() => {
      pedidoFornecedorRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        save: jest.fn(),
      } as unknown as jest.Mocked<PedidoFornecedorRepository>;
      mockFornecedorGateway = {
        enviarPedido: jest.fn().mockResolvedValue(undefined),
      } as jest.Mocked<IFornecedorGateway>;
    });

    it('deve criar pedido e emitir evento quando pecas sao validas', async () => {
      const useCase = new SolicitarPecasAoFornecedorUseCase(
        repo,
        pedidoFornecedorRepo,
        emissor,
        mockFornecedorGateway
      );
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1' }));
      pedidoFornecedorRepo.create.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [{ id_peca: 'peca-1', quantidade_solicitada: 5 }],
        status: 'PENDENTE',
        criado_em: new Date(),
      });

      await useCase.execute({
        fornecedorId: 'fornecedor-1',
        pecas: [{ pecaId: 'peca-1', quantidadeSolicitada: 5 }],
      });

      expect(pedidoFornecedorRepo.create).toHaveBeenCalled();
      expect(emissor.emitir).toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando lista de pecas vazia', async () => {
      const useCase = new SolicitarPecasAoFornecedorUseCase(
        repo,
        pedidoFornecedorRepo,
        emissor,
        mockFornecedorGateway
      );

      await expect(
        useCase.execute({
          fornecedorId: 'fornecedor-1',
          pecas: [],
        })
      ).rejects.toThrow(DomainException);
    });

    it('deve lancar BadRequestException quando pecas undefined', async () => {
      const useCase = new SolicitarPecasAoFornecedorUseCase(
        repo,
        pedidoFornecedorRepo,
        emissor,
        mockFornecedorGateway
      );

      await expect(
        useCase.execute({
          fornecedorId: 'fornecedor-1',
          pecas: undefined as unknown as Array<{ pecaId: string; quantidadeSolicitada: number }>,
        })
      ).rejects.toThrow(DomainException);
    });

    it('deve lancar NotFoundException quando peca nao existe no catalogo', async () => {
      const useCase = new SolicitarPecasAoFornecedorUseCase(
        repo,
        pedidoFornecedorRepo,
        emissor,
        mockFornecedorGateway
      );
      repo.findOne.mockResolvedValue(null);

      await expect(
        useCase.execute({
          fornecedorId: 'fornecedor-1',
          pecas: [{ pecaId: 'peca-inexistente', quantidadeSolicitada: 5 }],
        })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('deve validar todas as pecas antes de criar pedido', async () => {
      const useCase = new SolicitarPecasAoFornecedorUseCase(
        repo,
        pedidoFornecedorRepo,
        emissor,
        mockFornecedorGateway
      );
      repo.findOne.mockResolvedValueOnce(mockPeca({ id: 'peca-1' }));
      repo.findOne.mockResolvedValueOnce(mockPeca({ id: 'peca-2' }));
      pedidoFornecedorRepo.create.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [],
        status: 'PENDENTE',
        criado_em: new Date(),
      });

      await useCase.execute({
        fornecedorId: 'fornecedor-1',
        pecas: [
          { pecaId: 'peca-1', quantidadeSolicitada: 2 },
          { pecaId: 'peca-2', quantidadeSolicitada: 3 },
        ],
      });

      expect(repo.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('ReceberPecasDoFornecedorUseCase', () => {
    let pedidoFornecedorRepo: jest.Mocked<PedidoFornecedorRepository>;

    const pedidoFornecedorPendente: PedidoFornecedor = {
      id: 'pedido-1',
      fornecedor_id: 'fornecedor-1',
      itens: [
        {
          id: 'item-1',
          id_pedido_fornecedor: 'pedido-1',
          id_peca: 'peca-1',
          quantidade_solicitada: 5,
          quantidade_recebida: 0,
        },
      ],
      status: 'PENDENTE',
      criado_em: new Date(),
      atualizado_em: new Date(),
    };

    const pedidoFornecedorRecebido: PedidoFornecedor = {
      id: 'pedido-1',
      fornecedor_id: 'fornecedor-1',
      itens: [],
      status: 'RECEBIDO',
      criado_em: new Date(),
      atualizado_em: new Date(),
    };

    const pedidoFornecedorSalvo: PedidoFornecedor = {
      id: 'pedido-1',
      fornecedor_id: 'fornecedor-1',
      itens: [],
      status: 'PENDENTE',
      criado_em: new Date(),
      atualizado_em: new Date(),
    };

    beforeEach(() => {
      pedidoFornecedorRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        save: jest.fn(),
      } as unknown as jest.Mocked<PedidoFornecedorRepository>;
    });

    it('deve atualizar estoque e emitir evento quando pedido valido', async () => {
      const useCase = new ReceberPecasDoFornecedorUseCase(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue(pedidoFornecedorPendente);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 10 }));
      repo.updateEstoque.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 15 }));
      pedidoFornecedorRepo.save.mockResolvedValue(pedidoFornecedorSalvo);

      await useCase.execute({ pedidoId: 'pedido-1' });

      expect(repo.updateEstoque).toHaveBeenCalled();
      expect(emissor.emitir).toHaveBeenCalled();
    });

    it('deve lancar NotFoundException quando pedido nao existe', async () => {
      const useCase = new ReceberPecasDoFornecedorUseCase(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute({ pedidoId: 'pedido-inexistente' })).rejects.toThrow(
        EntityNotFoundException
      );
    });

    it('deve lancar ConflictException quando pedido ja foi recebido', async () => {
      const useCase = new ReceberPecasDoFornecedorUseCase(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue(pedidoFornecedorRecebido);

      await expect(useCase.execute({ pedidoId: 'pedido-1' })).rejects.toThrow(DomainException);
    });

    it('deve continuar quando peca nao existe no catalogo (skip)', async () => {
      const useCase = new ReceberPecasDoFornecedorUseCase(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue({
        ...pedidoFornecedorPendente,
        status: 'PENDENTE',
        itens: [
          {
            id: 'item-1',
            id_pedido_fornecedor: 'pedido-1',
            id_peca: 'peca-inexistente',
            quantidade_solicitada: 5,
            quantidade_recebida: 0,
          },
        ],
      });
      repo.findOne.mockResolvedValue(null);

      await useCase.execute({ pedidoId: 'pedido-1' });

      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: EstoqueAtualizadoAposRecebimento,
        })
      );
    });
  });

  describe('P-24 NotificarAdminReposicaoHandler', () => {
    it('should handle PecasIndisponiveis event without throwing', async () => {
      const mockGateway: jest.Mocked<INotificacaoAdminGateway> = {
        alertar: jest.fn().mockResolvedValue(undefined),
      };
      const handler = new NotificarAdminReposicaoHandler(mockGateway);

      await expect(
        handler.handle(new PecasIndisponiveis('os-1', ['peca-1']))
      ).resolves.not.toThrow();
    });
  });
});
