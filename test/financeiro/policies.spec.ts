// Este mock "engana" o Jest para que ele não tente carregar o cliente real do Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

// Mock do PrismaService para evitar que ele tente conectar à base de dados
jest.mock('../../src/shared/infrastructure/database/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RegistrarPagamentoPolicy } from '../../src/modules/financeiro/application/policies/registrar-pagamento.policy';
import { AcionarEntregaOrdemServicoPolicy } from '../../src/modules/financeiro/application/policies/acionar-entrega-ordem-servico.policy';
import {
  IPagamentoEventPublisher,
  IPagamentoRepository,
  PAGAMENTO_EVENT_PUBLISHER,
  PAGAMENTO_REPOSITORY,
} from '../../src/modules/financeiro/domain/interfaces/pagamento.interface';
import { PagamentoRegistradoEvent } from '../../src/modules/financeiro/domain/events/pagamento-registrado.event';
import { EmissorEventos } from '../../src/shared/infrastructure/emissor-eventos/emissor-eventos.service';

describe('Módulo Financeiro: Policies de Fluxo', () => {
  let mockRepository: jest.Mocked<IPagamentoRepository>;
  let mockEmissor: jest.Mocked<IPagamentoEventPublisher>;

  beforeEach(() => {
    mockRepository = { save: jest.fn(), findById: jest.fn() } as jest.Mocked<IPagamentoRepository>;
    mockEmissor = { emitir: jest.fn() } as jest.Mocked<IPagamentoEventPublisher>;
  });

  describe('RegistrarPagamentoPolicy (P-26)', () => {
    let policy: RegistrarPagamentoPolicy;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RegistrarPagamentoPolicy,
          { provide: PAGAMENTO_REPOSITORY, useValue: mockRepository },
          { provide: PAGAMENTO_EVENT_PUBLISHER, useValue: mockEmissor },
        ],
      }).compile();
      policy = module.get<RegistrarPagamentoPolicy>(RegistrarPagamentoPolicy);
    });

    it('deve persistir pagamento e emitir evento de sucesso', async () => {
      await policy.execute({ ordemServicoId: 'os-1', valor: 100 });

      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEmissor.emitir).toHaveBeenCalledWith(expect.any(PagamentoRegistradoEvent));
    });
  });

  describe('AcionarEntregaOrdemServicoPolicy (P-27)', () => {
    let policy: AcionarEntregaOrdemServicoPolicy;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AcionarEntregaOrdemServicoPolicy,
          { provide: EmissorEventos, useValue: mockEmissor },
        ],
      }).compile();
      policy = module.get<AcionarEntregaOrdemServicoPolicy>(AcionarEntregaOrdemServicoPolicy);
    });

    it('deve traduzir o evento interno para o contrato de integração da OS', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('pag-id', 'os-id');

      await policy.handle(eventoInterno);

      // Usamos 'as any' para validar propriedades que o TypeScript ainda não conhece (Cross-Module)
      const eventoPublicado = mockEmissor.emitir.mock.calls[0][0] as any;

      expect(eventoPublicado.ordemServicoId).toBe('os-id');
      expect(eventoPublicado.pagamentoId).toBe('pag-id');
      expect(eventoPublicado.eventId).toBeDefined();
    });

    it('deve cobrir branches do logger na criação do evento', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('os-123', 'pag-456');
      mockEmissor.emitir.mockResolvedValue(undefined);

      await policy.handle(eventoInterno);

      expect(mockEmissor.emitir).toHaveBeenCalled();
    });

    it('deve cobrir branches do logger após emissão', async () => {
      const eventoInterno = new PagamentoRegistradoEvent('os-789', 'pag-101');
      mockEmissor.emitir.mockResolvedValue(undefined);

      await policy.handle(eventoInterno);

      expect(mockEmissor.emitir).toHaveBeenCalledTimes(1);
    });
  });
});
