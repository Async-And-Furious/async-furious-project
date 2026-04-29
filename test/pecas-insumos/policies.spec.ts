import { Logger } from '@nestjs/common';
import { VerificarDisponibilidadeEstoquePolicy } from '../../src/modules/pecas-insumos/application/policies/verificar-disponibilidade-estoque.policy';
import { DebitarEstoquePolicy } from '../../src/modules/pecas-insumos/application/policies/debitar-estoque.policy';
import { NotificarPecasIndisponiveisPolicy } from '../../src/modules/pecas-insumos/application/policies/notificar-pecas-indisponiveis.policy';
import { NotificarAdminReposicaoPolicy } from '../../src/modules/pecas-insumos/application/policies/notificar-admin-reposicao.policy';
import { OrcamentoAprovadoComPecas } from '../../src/modules/ordem-servico/domain/events/orcamento-aprovado-com-pecas.event';
import { PecasEmEstoqueConfirmadas } from '../../src/modules/pecas-insumos/domain/events/pecas-em-estoque-confirmadas.event';
import { PecasNaoExistem } from '../../src/modules/pecas-insumos/domain/events/pecas-nao-existem.event';
import { PecasIndisponiveis } from '../../src/modules/pecas-insumos/domain/events/pecas-indisponiveis.event';
import { EstoqueDebitado } from '../../src/modules/pecas-insumos/domain/events/estoque-debitado.event';
import { PecasReservadas } from '../../src/modules/pecas-insumos/domain/events/pecas-reservadas.event';
import type { IPecaInsumoRepository } from '../../src/modules/pecas-insumos/domain/interfaces/peca-insumo.interface';
import type { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';
import type { PecaInsumo } from '../../src/modules/pecas-insumos/domain/entities/peca-insumo.entity';

const mockPeca = (overrides: Partial<PecaInsumo> = {}): PecaInsumo => ({
  id: 'peca-1',
  nome: 'Filtro de Oleo',
  codigo: 'FLT-001',
  descricao: null,
  preco: 50,
  quantidade_estoque: 10,
  quantidade_minima: 2,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('PecasInsumos Policies', () => {
  let repo: jest.Mocked<IPecaInsumoRepository>;
  let emissor: jest.Mocked<EmissorEventos>;

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
});
