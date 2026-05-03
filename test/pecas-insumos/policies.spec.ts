import { Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { VerificarDisponibilidadeEstoquePolicy } from '../../src/modules/pecas-insumos/application/policies/verificar-disponibilidade-estoque.policy';
import { DebitarEstoquePolicy } from '../../src/modules/pecas-insumos/application/policies/debitar-estoque.policy';
import { NotificarPecasIndisponiveisPolicy } from '../../src/modules/pecas-insumos/application/policies/notificar-pecas-indisponiveis.policy';
import { NotificarAdminReposicaoPolicy } from '../../src/modules/pecas-insumos/application/policies/notificar-admin-reposicao.policy';
import { ValidarBacklogOrdensPendentesPolicy } from '../../src/modules/pecas-insumos/application/policies/validar-backlog-ordens-pendentes.policy';
import { LiberarOrdensAguardandoPecasPolicy } from '../../src/modules/pecas-insumos/application/policies/liberar-ordens-aguardando-pecas.policy';
import { SolicitarPecasFornecedorPolicy } from '../../src/modules/pecas-insumos/application/policies/solicitar-pecas-fornecedor.policy';
import { ReceberPecasFornecedorPolicy } from '../../src/modules/pecas-insumos/application/policies/receber-pecas-fornecedor.policy';
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

describe('PecasInsumos Policies', () => {
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

  describe('VerificarDisponibilidadeEstoquePolicy (P-18)', () => {
    it('deve emitir PecasEmEstoqueConfirmadas quando todas as pecas estao disponiveis', async () => {
      const policy = new VerificarDisponibilidadeEstoquePolicy(repo, emissor);
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

      await policy.handle(new OrcamentoAprovadoComPecas('os-1', 'orc-1'));

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
      const policy = new VerificarDisponibilidadeEstoquePolicy(repo, emissor);
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

      await policy.handle(new OrcamentoAprovadoComPecas('os-1', 'orc-1'));

      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: PecasNaoExistem,
          ordemServicoId: 'os-1',
          idsPecasIndisponiveis: ['peca-1'],
        })
      );
    });
  });

  describe('DebitarEstoquePolicy (P-19)', () => {
    it('deve debitar estoque e emitir EstoqueDebitado e PecasReservadas', async () => {
      const policy = new DebitarEstoquePolicy(repo, emissor);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 10 }));
      repo.updateEstoque.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 7 }));

      const evento = new PecasEmEstoqueConfirmadas('os-1', [
        { id_peca: 'peca-1', quantidade: 3, preco_unitario: 50 },
      ]);

      await policy.handle(evento);

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

  describe('NotificarPecasIndisponiveisPolicy (P-20)', () => {
    it('deve emitir PecasIndisponiveis a partir de PecasNaoExistem', async () => {
      const policy = new NotificarPecasIndisponiveisPolicy(emissor);

      await policy.handle(new PecasNaoExistem('os-1', ['peca-1', 'peca-2']));

      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: PecasIndisponiveis,
          ordemServicoId: 'os-1',
          idsPecasIndisponiveis: ['peca-1', 'peca-2'],
        })
      );
    });
  });

  describe('NotificarAdminReposicaoPolicy (P-21)', () => {
    it('deve registrar aviso para reposicao quando PecasIndisponiveis ocorrer', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const policy = new NotificarAdminReposicaoPolicy();

      policy.handle(new PecasIndisponiveis('os-1', ['peca-1']));

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('ValidarBacklogOrdensPendentesPolicy (P-22)', () => {
    it('deve emitir BacklogValidadoPecasDisponiveis quando estoque suporta a OS aguardando pecas', async () => {
      const policy = new ValidarBacklogOrdensPendentesPolicy(
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

      await policy.handle(
        new EstoqueAtualizadoAposRecebimento([{ pecaId: 'peca-1', novaQuantidade: 3 }])
      );

      expect(backlogPort.findAllAguardandoPecas).toHaveBeenCalledTimes(1);
      const emitido = emissor.emitir.mock.calls[0][0] as BacklogValidadoPecasDisponiveis;
      expect(emitido).toBeInstanceOf(BacklogValidadoPecasDisponiveis);
      expect(emitido.ordemId).toBe('os-1');
    });

    it('nao deve emitir evento quando ainda faltar estoque para atender backlog', async () => {
      const policy = new ValidarBacklogOrdensPendentesPolicy(
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

      await policy.handle(
        new EstoqueAtualizadoAposRecebimento([{ pecaId: 'peca-1', novaQuantidade: 2 }])
      );

      expect(backlogPort.findAllAguardandoPecas).toHaveBeenCalledTimes(1);
      expect(emissor.emitir).not.toHaveBeenCalled();
    });

    it('não deve emitir evento quando peca não for encontrada no estoque', async () => {
      const policy = new ValidarBacklogOrdensPendentesPolicy(
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

      await policy.handle(
        new EstoqueAtualizadoAposRecebimento([{ pecaId: 'peca-inexistente', novaQuantidade: 0 }])
      );

      expect(emissor.emitir).not.toHaveBeenCalled();
    });
  });

  describe('LiberarOrdensAguardandoPecasPolicy (P-25)', () => {
    it('deve debitar, reservar e emitir PecasReservadas quando backlog estiver validado', async () => {
      const policy = new LiberarOrdensAguardandoPecasPolicy(
        repo as unknown as PecaInsumoRepository,
        reservaRepo,
        emissor
      );

      reservaRepo.existsByOrdemId.mockResolvedValue(false);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 10 }));

      await policy.handle({
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
      const policy = new LiberarOrdensAguardandoPecasPolicy(
        repo as unknown as PecaInsumoRepository,
        reservaRepo,
        emissor
      );

      reservaRepo.existsByOrdemId.mockResolvedValue(true);

      await policy.handle({
        ordemId: 'os-1',
        pecas: [{ pecaId: 'peca-1', quantidadeNecessaria: 1 }],
      });

      expect(repo.findOne).not.toHaveBeenCalled();
      expect(reservaRepo.save).not.toHaveBeenCalled();
      expect(emissor.emitir).not.toHaveBeenCalled();
    });

    it('deve throw NotFoundException quando peca nao for encontrada', async () => {
      const policy = new LiberarOrdensAguardandoPecasPolicy(
        repo as unknown as PecaInsumoRepository,
        reservaRepo,
        emissor
      );

      reservaRepo.existsByOrdemId.mockResolvedValue(false);
      repo.findOne.mockResolvedValue(null);

      await expect(
        policy.handle({
          ordemId: 'os-1',
          pecas: [{ pecaId: 'peca-inexistente', quantidadeNecessaria: 1 }],
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SolicitarPecasFornecedorPolicy', () => {
    let pedidoFornecedorRepo: jest.Mocked<PedidoFornecedorRepository>;

    beforeEach(() => {
      pedidoFornecedorRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        save: jest.fn(),
      } as unknown as jest.Mocked<PedidoFornecedorRepository>;
    });

    it('deve criar pedido e emitir evento quando pecas sao validas', async () => {
      const policy = new SolicitarPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1' }));
      pedidoFornecedorRepo.create.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [{ id_peca: 'peca-1', quantidade_solicitada: 5 }],
        status: 'PENDENTE',
        criado_em: new Date(),
      });

      await policy.execute({
        fornecedorId: 'fornecedor-1',
        pecas: [{ pecaId: 'peca-1', quantidadeSolicitada: 5 }],
      });

      expect(pedidoFornecedorRepo.create).toHaveBeenCalled();
      expect(emissor.emitir).toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando lista de pecas vazia', async () => {
      const policy = new SolicitarPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);

      await expect(
        policy.execute({
          fornecedorId: 'fornecedor-1',
          pecas: [],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lancar BadRequestException quando pecas undefined', async () => {
      const policy = new SolicitarPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);

      await expect(
        policy.execute({
          fornecedorId: 'fornecedor-1',
          pecas: undefined as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lancar NotFoundException quando peca nao existe no catalogo', async () => {
      const policy = new SolicitarPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      repo.findOne.mockResolvedValue(null);

      await expect(
        policy.execute({
          fornecedorId: 'fornecedor-1',
          pecas: [{ pecaId: 'peca-inexistente', quantidadeSolicitada: 5 }],
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('deve validar todas as pecas antes de criar pedido', async () => {
      const policy = new SolicitarPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      repo.findOne.mockResolvedValueOnce(mockPeca({ id: 'peca-1' }));
      repo.findOne.mockResolvedValueOnce(mockPeca({ id: 'peca-2' }));
      pedidoFornecedorRepo.create.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [],
        status: 'PENDENTE',
        criado_em: new Date(),
      });

      await policy.execute({
        fornecedorId: 'fornecedor-1',
        pecas: [
          { pecaId: 'peca-1', quantidadeSolicitada: 2 },
          { pecaId: 'peca-2', quantidadeSolicitada: 3 },
        ],
      });

      expect(repo.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('ReceberPecasFornecedorPolicy', () => {
    let pedidoFornecedorRepo: jest.Mocked<PedidoFornecedorRepository>;

    beforeEach(() => {
      pedidoFornecedorRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        save: jest.fn(),
      } as unknown as jest.Mocked<PedidoFornecedorRepository>;
    });

    it('deve atualizar estoque e emitir evento quando pedido valido', async () => {
      const policy = new ReceberPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [{ id_peca: 'peca-1', quantidade_solicitada: 5 }],
        status: 'PENDENTE',
        criado_em: new Date(),
      });
      repo.findOne.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 10 }));
      repo.updateEstoque.mockResolvedValue(mockPeca({ id: 'peca-1', quantidade_estoque: 15 }));
      pedidoFornecedorRepo.save.mockResolvedValue({} as any);

      await policy.execute({ pedidoId: 'pedido-1' });

      expect(repo.updateEstoque).toHaveBeenCalled();
      expect(emissor.emitir).toHaveBeenCalled();
    });

    it('deve lancar NotFoundException quando pedido nao existe', async () => {
      const policy = new ReceberPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue(null);

      await expect(policy.execute({ pedidoId: 'pedido-inexistente' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('deve lancar ConflictException quando pedido ja foi recebido', async () => {
      const policy = new ReceberPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [],
        status: 'RECEBIDO',
        criado_em: new Date(),
      });

      await expect(policy.execute({ pedidoId: 'pedido-1' })).rejects.toThrow(ConflictException);
    });

    it('deve continuar quando peca nao existe no catalogo (skip)', async () => {
      const policy = new ReceberPecasFornecedorPolicy(repo, pedidoFornecedorRepo, emissor);
      pedidoFornecedorRepo.findById.mockResolvedValue({
        id: 'pedido-1',
        fornecedor_id: 'fornecedor-1',
        itens: [{ id_peca: 'peca-inexistente', quantidade_solicitada: 5 }],
        status: 'PENDENTE',
        criado_em: new Date(),
      });
      repo.findOne.mockResolvedValue(null);

      await policy.execute({ pedidoId: 'pedido-1' });

      expect(emissor.emitir).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: EstoqueAtualizadoAposRecebimento,
        })
      );
    });
  });

  describe('P-24 NotificarAdminReposicaoPolicy', () => {
    it('should handle PecasIndisponiveis event without throwing', () => {
      const policy = new NotificarAdminReposicaoPolicy();

      expect(() => policy.handle(new PecasIndisponiveis('os-1', ['peca-1']))).not.toThrow();
    });
  });
});
